import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from "@aws-sdk/client-sqs";
import "dotenv/config";
import { supabase } from "./lib/supabase";
import { runAnalyst } from "./agents/analyst";
import { buildSkepticSummary } from "./agents/skeptic";
import { sendReportEmail } from "./lib/email";
import { generateReportPDFBuffer } from "./components/ReportPDF";

const region = process.env.AWS_REGION || "us-east-1";
const queueUrl = process.env.AWS_SQS_QUEUE_URL;

const sqsClient = new SQSClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function handleFinalizeInterview(data: { conversationId: number; conversationTitle: string }) {
  const { conversationId, conversationTitle } = data;

  console.log(`[SQS Worker] Processing finalize-interview for convId: ${conversationId}`);

  // Step 1: Fetch conversation transcript
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) throw new Error(`Failed to fetch messages: ${messagesError.message}`);

  // Step 2: Fetch interview state
  const { data: interviewState, error: stateError } = await supabase
    .from("interview_states")
    .select("red_flags, green_flags, conversation_summary, vague_topics, pitch_deck_url")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (stateError) throw new Error(`Failed to fetch interview state: ${stateError.message}`);
  if (!interviewState) throw new Error(`No interview state found for convId: ${conversationId}`);

  // Step 3: Run Analyst agent
  const conversationHistory = (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const convSummary = interviewState.conversation_summary || {};
  const pitchDeckUrl = interviewState.pitch_deck_url || undefined;
  const skepticSummary = buildSkepticSummary(
    interviewState.red_flags || [],
    interviewState.green_flags || []
  );

  const reportMarkdown = await runAnalyst({
    conversationHistory,
    skepticSummary,
    companyName: convSummary.company_name || undefined,
    pitchDeckUrl,
    websiteUrl: convSummary.website_url || undefined,
    vagueTopics: interviewState.vague_topics || [],
  });

  // Step 4: Store the report
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "system",
    content: reportMarkdown,
  });

  // Step 5: Send email
  const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL;
  if (recipientEmail) {
    const pdfBuffer = await generateReportPDFBuffer(reportMarkdown);
    const companyName = convSummary.company_name || undefined;

    await sendReportEmail({
      recipientEmail,
      pdfBuffer,
      conversationTitle,
      conversationId,
      companyName,
    });
  }

  // Step 6: Mark complete
  await supabase
    .from("conversations")
    .update({ status: "completed" })
    .eq("id", conversationId);

  console.log(`[SQS Worker] Successfully processed convId: ${conversationId}`);
}

async function startWorker() {
  if (!queueUrl) {
    console.error("❌ AWS_SQ_QUEUE_URL is not defined. Worker exiting.");
    process.exit(1);
  }

  console.log("🚀 SQS Worker started. Polling messages...");

  while (true) {
    try {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, // Long polling
      });

      const response = await sqsClient.send(receiveCommand);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          await processMessage(message);
        }
      }
    } catch (error) {
      console.error("❌ SQS Worker Error:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retry
    }
  }
}

async function processMessage(message: Message) {
  try {
    const body = JSON.parse(message.Body || "{}");
    const { name, data } = body;

    if (name === "interview/finalize") {
      await handleFinalizeInterview(data);
    } else {
      console.warn(`[SQS Worker] Unknown event name: ${name}`);
    }

    // Delete message after successful processing
    const deleteCommand = new DeleteMessageCommand({
      QueueUrl: queueUrl!,
      ReceiptHandle: message.ReceiptHandle!,
    });
    await sqsClient.send(deleteCommand);
  } catch (error) {
    console.error(`❌ Error processing SQS message ${message.MessageId}:`, error);
    // Message will become visible again after VisibilityTimeout
  }
}

startWorker();
