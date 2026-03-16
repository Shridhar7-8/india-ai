import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { runAnalyst } from "@/agents/analyst";
import { buildSkepticSummary } from "@/agents/skeptic";
import { sendReportEmail } from "@/lib/email";
import { generateReportPDFBuffer } from "@/components/ReportPDF";

// Diagnostic: Log environment status on load (will show in server logs)
console.log("[Inngest] Functions module loaded. Event Key present:", !!process.env.INNGEST_EVENT_KEY);
console.log("[Inngest] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * Inngest function: finalize-interview
 * 
 * Triggered when the Conductor decides TERMINATE_INTERVIEW.
 * Steps:
 *   1. Fetch full conversation transcript from Supabase
 *   2. Fetch interview state (red flags)
 *   3. Run Analyst agent to generate markdown report
 *   4. Generate a simple text-based PDF (or store markdown)
 *   5. Send email with report
 *   6. Mark conversation as completed
 */
export const finalizeInterview = inngest.createFunction(
  {
    id: "finalize-interview",
    retries: 2,
  },
  { event: "interview/finalize" },
  async ({ event, step }) => {
    const { conversationId, conversationTitle } = event.data as {
      conversationId: number;
      conversationTitle: string;
    };

    // Step 1: Fetch conversation transcript
    const messages = await step.run("fetch-transcript", async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
      return data || [];
    });

    // Step 2: Fetch interview state (red flags)
    const interviewState = await step.run("fetch-interview-state", async () => {
      console.log(`[Inngest] Fetching interview state for convId: ${conversationId}`);
      const { data, error } = await supabase
        .from("interview_states")
          .select("red_flags, green_flags, conversation_summary, vague_topics, pitch_deck_url")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (error) {
        console.error(`[Inngest] Supabase error fetching state: ${error.message}`);
        throw new Error(`Failed to fetch interview state from database: ${error.message}`);
      }

      if (!data) {
        console.error(`[Inngest] No interview state found for convId: ${conversationId}`);
        throw new Error(`Critical Error: Interview state record missing for conversation ID ${conversationId}. Background task cannot proceed.`);
      }

      return data;
    });

    // Step 3: Run Analyst agent to generate markdown report
    const reportMarkdown = await step.run("generate-report", async () => {
      console.log(`[Inngest] Running Analyst for convId: ${conversationId}`);
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const convSummary = interviewState.conversation_summary || {};
      // Get pitch deck URL from the state (saved directly as Google Drive Link)
      const pitchDeckUrl = interviewState.pitch_deck_url || undefined;

      const skepticSummary = buildSkepticSummary(
        interviewState.red_flags || [],
        interviewState.green_flags || []
      );

      const report = await runAnalyst({
        conversationHistory,
        skepticSummary,
        companyName: convSummary.company_name || undefined,
        pitchDeckUrl,
        websiteUrl: convSummary.website_url || undefined,
        vagueTopics: interviewState.vague_topics || [],
      });

      console.log(`[Inngest] Report generated successfully for convId: ${conversationId} (Length: ${report.length})`);
      return report;
    });

    // Step 4: Store the report as a system message in the conversation
    await step.run("store-report", async () => {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "system",
        content: reportMarkdown,
      });
    });

    // Step 5: Send email with report
    await step.run("send-email", async () => {
      const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL;
      if (!recipientEmail) {
        console.log("⚠️ No REPORT_RECIPIENT_EMAIL configured, skipping email.");
        return;
      }

      // Generate styled PDF buffer using React-PDF
      const pdfBuffer = await generateReportPDFBuffer(reportMarkdown);

      const companyName =
        interviewState.conversation_summary?.company_name || undefined;

      await sendReportEmail({
        recipientEmail,
        pdfBuffer,
        conversationTitle,
        conversationId,
        companyName,
      });
    });

    // Step 6: Ensure conversation is marked completed
    await step.run("mark-complete", async () => {
      await supabase
        .from("conversations")
        .update({ status: "completed" })
        .eq("id", conversationId);
    });

    return {
      success: true,
      conversationId,
      reportLength: reportMarkdown.length,
    };
  }
);