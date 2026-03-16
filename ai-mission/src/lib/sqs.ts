import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export async function sendSQSMessage(name: string, data: any) {
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey || !queueUrl) {
    throw new Error("AWS_SQS_QUEUE_URL or credentials are not defined in environment variables");
  }

  const sqsClient = new SQSClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({ name, data }),
    MessageAttributes: {
      "EventName": {
        DataType: "String",
        StringValue: name,
      },
    },
  });

  try {
    const result = await sqsClient.send(command);
    console.log(`✅ SQS message sent: ${name} (MessageId: ${result.MessageId})`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to send SQS message: ${name}`, error);
    throw error;
  }
}
