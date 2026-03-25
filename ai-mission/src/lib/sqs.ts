import "dotenv/config";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

console.log("[SQS] Client initialized. Region:", process.env.AWS_REGION, "Key present:", !!process.env.AWS_ACCESS_KEY_ID);

export async function sendToQueue(name: string, data: unknown) {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error("AWS_SQS_QUEUE_URL is not defined in environment variables");
    return;
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ name, data }),
    });

    const response = await sqsClient.send(command);
    console.log(`[SQS] Message sent to queue: ${name}. MessageId: ${response.MessageId}`);
    return response;
  } catch (error) {
    console.error(`[SQS] Error sending message to queue: ${name}`, error);
    throw error;
  }
}
