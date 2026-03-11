import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { MessageCreateSchema } from "@/lib/schemas";
import { runConductorFSM, getInitialChecklist, getInitialSummary, STEPS } from "@/agents/conductor";
import { runSkeptic } from "@/agents/skeptic";
import { inngest } from "@/inngest/client";

/**
 * POST /api/chat — Main chat endpoint.
 * Orchestrates the FSM-based multi-agent flow for each user message.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth();
    const activeUserId = (process.env.NODE_ENV === "development" && req.headers.get("x-e2e-userid")) || userId;

    if (!activeUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate input
    const body = await req.json();
    const parsed = MessageCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { content, conversationId } = parsed.data;
    let convId = conversationId;

    // 3. Create conversation if needed
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({ clerk_user_id: activeUserId, title: "New Conversation" })
        .select()
        .single();

      if (convError || !newConv) {
        console.error("Error creating conversation:", convError);
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      }
      convId = newConv.id;

      // Create interview state with step_index = 0
      await supabase.from("interview_states").insert({
        conversation_id: convId,
        checklist: getInitialChecklist(),
        conversation_summary: getInitialSummary(),
        step_index: 0,
        current_drill_count: 0,
        vague_topics: [],
      });
    }

    // 4. Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, clerk_user_id, status")
      .eq("id", convId)
      .single();

    if (!conversation || conversation.clerk_user_id !== activeUserId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.status === "completed") {
      return NextResponse.json(
        { error: "This interview has already been completed" },
        { status: 400 }
      );
    }

    // 5. Save user message
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content,
    });

    // 6. Get interview state
    const { data: interviewState } = await supabase
      .from("interview_states")
      .select("*")
      .eq("conversation_id", convId)
      .single();

    if (!interviewState) {
      return NextResponse.json({ error: "Interview state not found" }, { status: 500 });
    }

    // 7. Get conversation history
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    const conversationHistory = (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 8. Run FSM Conductor
    const stepIndex = interviewState.step_index ?? 0;
    const drillCount = interviewState.current_drill_count ?? 0;

    const fsmResult = await runConductorFSM({
      userMessage: content,
      stepIndex,
      drillCount,
      conversationHistory,
      founderIsSolo: interviewState.founder_is_solo ?? undefined,
    });

    // 9. Save assistant message
    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: fsmResult.response,
    });

    // 10. Update checklist (backward compat for report generation)
    const updatedChecklist = { ...interviewState.checklist };
    if (fsmResult.checklistUpdate) {
      updatedChecklist[fsmResult.checklistUpdate.key] = fsmResult.checklistUpdate.value;
    }

    // 10b. Extract founder_name and company_name when those steps are completed
    const updatedSummary = { ...interviewState.conversation_summary };
    const completedStepId = stepIndex < STEPS.length ? STEPS[stepIndex].id : null;
    if (fsmResult.checklistUpdate) {
      if (completedStepId === "name") {
        // Extract name from the user's message
        updatedSummary.founder_name = content
          .replace(/^(hi|hello|hey|greetings|good\s+\w+)[\s,!.]*/i, "")
          .replace(/^(my name is|i am|i'm|this is|call me|it's|its)\s*/i, "")
          .replace(/[.!,]+$/g, "")
          .trim() || content;
      }
      if (completedStepId === "company_name") {
        // Deterministic multi-pass strip to extract company name from natural language
        const name = content
          // Pass 1: Strip "name of my/our/the company/startup/venture (is)"
          .replace(/^(the\s+)?(name\s+of\s+(my|our|the)\s+(company|startup|venture)\s*(is)?)\s*/i, "")
          // Pass 2: Strip "my/our company (name) is" / "the company/startup is"
          .replace(/^(my|our|the)\s+(company|startup|venture)\s*(name\s*)?(is\s*(called\s*)?)?/i, "")
          // Pass 3: Strip "it's/its (called)" / "we are (called)" / "I am from"
          .replace(/^(it'?s\s*(called\s*)?|we\s+are\s*(called\s*)?|i\s+am\s+from\s*)/i, "")
          // Pass 4: Strip leading filler "it is" / "is" / "called"
          .replace(/^(it\s+is\s+|is\s+|called\s+)/i, "")
          // Pass 5: Clean trailing punctuation
          .replace(/[.!,;]+$/g, "")
          .trim();
        updatedSummary.company_name = name || content.replace(/[.!,;]+$/g, "").trim();
      }
      if (completedStepId === "pitch_deck") {
        // If user uploaded a file, the message will contain "uploaded" and the filename
        if (content.toLowerCase().includes("uploaded")) {
          const match = content.match(/:\s*(.+)$/);
          updatedSummary.pitch_deck_file = match ? match[1].trim() : "uploaded";
        }
      }
      if (completedStepId === "website") {
        // Extract just the URL/domain from user's message
        // e.g. "Yes, our website is legalmind.ai" → "legalmind.ai"
        // e.g. "bolo.ai" → "bolo.ai"
        // e.g. "https://www.example.com" → "https://www.example.com"
        const urlMatch = content.match(
          /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/\S*)?)/i
        );
        updatedSummary.website_url = urlMatch ? urlMatch[0] : content;
      }
    }

    // Track drill-down counts for logging
    const updatedDrillDowns = { ...interviewState.drill_down_counts };
    if (fsmResult.nextStepIndex < STEPS.length) {
      const currentStepId = STEPS[fsmResult.nextStepIndex]?.id;
      if (currentStepId) {
        updatedDrillDowns[currentStepId] = fsmResult.nextDrillCount;
      }
    }

    // Determine current phase
    const phase1Topics = [
      "name", "professional_background", "education_background",
      "life_goals", "startup_vs_technology", "founder_status",
      "financial_obligations", "failure_story", "hobbies", "the_why",
    ];
    const phase2Topics = [
      "startup_idea", "zone_1_desirability", "zone_2_viability",
      "zone_3_feasibility", "zone_4_defensibility", "zone_5_affordability",
    ];
    const phase3Topics = [
      "ai_interest", "ai_necessity", "ai_ecosystem_contribution",
      "indiaai_awareness", "indiaai_alignment",
    ];
    const phase1Complete = phase1Topics.every((t) => updatedChecklist[t]);
    const phase2Complete = phase2Topics.every((t) => updatedChecklist[t]);
    const phase3Complete = phase3Topics.every((t) => updatedChecklist[t]);
    let currentPhase = "Phase 1 - Founder";
    if (phase1Complete && phase2Complete && phase3Complete) currentPhase = "Phase 4 - Closing";
    else if (phase1Complete && phase2Complete) currentPhase = "Phase 3 - AI & IndiaAI";
    else if (phase1Complete) currentPhase = "Phase 2 - Business";

    const isComplete = fsmResult.isComplete;

    // Track vague topics
    const updatedVagueTopics = [...(interviewState.vague_topics || [])];
    if (fsmResult.notedVague && !updatedVagueTopics.includes(fsmResult.notedVague)) {
      updatedVagueTopics.push(fsmResult.notedVague);
    }

    await supabase
      .from("interview_states")
      .update({
        checklist: updatedChecklist,
        conversation_summary: updatedSummary,
        drill_down_counts: updatedDrillDowns,
        current_phase: currentPhase,
        is_complete: isComplete,
        turn_count: interviewState.turn_count + 1,
        step_index: fsmResult.nextStepIndex,
        current_drill_count: fsmResult.nextDrillCount,
        vague_topics: updatedVagueTopics,
        ...(fsmResult.founderIsSolo !== undefined ? { founder_is_solo: fsmResult.founderIsSolo } : {}),
      })
      .eq("conversation_id", convId);

    // 11. Run Skeptic agent in background (fire-and-forget)
    const currentStepId = stepIndex < STEPS.length ? STEPS[stepIndex].id : "unknown";
    runSkeptic({
      userMessage: content,
      currentTopic: currentStepId,
      conversationHistory,
      existingRedFlags: interviewState.red_flags || [],
      existingGreenFlags: interviewState.green_flags || [],
    }).then(async (newFlags) => {
      if (newFlags.redFlags.length > 0 || newFlags.greenFlags.length > 0) {
        const allRedFlags = [...(interviewState.red_flags || []), ...newFlags.redFlags];
        const allGreenFlags = [...(interviewState.green_flags || []), ...newFlags.greenFlags];
        await supabase
          .from("interview_states")
          .update({ 
            red_flags: allRedFlags, 
            green_flags: allGreenFlags 
          })
          .eq("conversation_id", convId);
      }
    }).catch((err) => {
      console.error("Skeptic background error (non-critical):", err);
    });

    // 12. If interview is complete, trigger Inngest background job
    if (isComplete) {
      console.log("🏁 Interview complete! Triggering report generation...");
      const founderName = updatedSummary?.founder_name || "Unknown Founder";
      const companyName = updatedSummary?.company_name || "";
      const title = companyName || `${founderName} Interview`;

      await supabase
        .from("conversations")
        .update({ title, status: "completed" })
        .eq("id", convId);

      try {
        await inngest.send({
          name: "interview/finalize",
          data: {
            conversationId: convId,
            conversationTitle: title,
          },
        });
        console.log("✅ Inngest event 'interview/finalize' sent successfully for conversation:", convId);
      } catch (inngestError) {
        console.error("❌ Failed to send Inngest event:", inngestError);
      }
    }

    // 13. Return response
    // Compute the current step ID for the frontend
    const nextStepId = fsmResult.nextStepIndex < STEPS.length
      ? STEPS[fsmResult.nextStepIndex].id
      : null;

    return NextResponse.json({
      conversationId: convId,
      response: fsmResult.response,
      stepIndex: fsmResult.nextStepIndex,
      totalSteps: STEPS.length,
      currentStepId: nextStepId,
      isComplete,
      currentPhase,
    });
  } catch (error) {
    console.error("❌ Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}