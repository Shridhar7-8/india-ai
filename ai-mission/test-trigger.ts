import { sendSQSMessage } from "./src/lib/sqs";
import "dotenv/config";

/**
 * TEST SQS TRIGGER SCRIPT
 * 
 * This script manually sends an "interview/finalize" message to SQS.
 * Use this to test if your SQS Worker is correctly picking up messages
 * and processing them (generating reports, sending emails, etc.)
 */

async function triggerTest() {
  // Use the most recent conversation ID or a specific one you want to test
  const testData = {
    conversationId: 251, // Replace with your conversation ID
    conversationTitle: "Manual Test Interview",
  };

  console.log(`🚀 Sending SQS message for Conversation ID: ${testData.conversationId}...`);

  try {
    const result = await sendSQSMessage("interview/finalize", testData);
    console.log("✅ SQS message sent successfully!");
    console.log("Message ID:", result.MessageId);
    console.log("\nNext Steps:");
    console.log("1. Make sure your worker is running: npm run worker");
    console.log("2. Check the worker terminal output to see if it processes this ID.");
  } catch (error) {
    console.error("❌ Failed to send SQS message:", error);
    console.log("\nNote: Make sure your AWS_SQS_QUEUE_URL and credentials are set in .env");
  }
}

triggerTest();
