import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { runAnalyst } from "@/agents/analyst";
import { sendReportEmail } from "@/lib/email";
import { generateReportPDFBuffer } from "@/components/ReportPDF";

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
      const { data, error } = await supabase
        .from("interview_states")
        .select("red_flags, conversation_summary")
        .eq("conversation_id", conversationId)
        .single();

      if (error) throw new Error(`Failed to fetch interview state: ${error.message}`);
      return data;
    });

    // Step 3: Run Analyst agent to generate markdown report
    const reportMarkdown = await step.run("generate-report", async () => {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const convSummary = interviewState.conversation_summary || {};
      // Build pitch deck storage URL if file was uploaded
      const pitchDeckFile = convSummary.pitch_deck_file;
      const pitchDeckUrl = pitchDeckFile
        ? `${conversationId}/${pitchDeckFile}`
        : undefined;

      const report = await runAnalyst({
        conversationHistory,
        redFlags: interviewState.red_flags || [],
        companyName: convSummary.company_name || undefined,
        pitchDeckUrl,
        websiteUrl: convSummary.website_url || undefined,
      });

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