import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";

/**
 * The Amazon Bedrock provider instance.
 * It uses the AWS_BEARER_TOKEN_BEDROCK environment variable by default if apiKey is not provided.
 */
const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    apiKey: process.env.AWS_BEDROCK_API_KEY,
});

/**
 * Conductor and Skeptic model: nvidia.nemotron-nano-3-30b
 */
const conductorModel = process.env.CONDUCTOR_MODEL || "nvidia.nemotron-nano-3-30b";

/**
 * Analyst model: openai.gpt-oss-120b-1:0
 */
const analystModelId = process.env.ANALYST_MODEL || "openai.gpt-oss-120b-1:0";

/**
 * Get the Conductor model instance.
 */
export function getModel() {
    return bedrock(conductorModel);
}

/**
 * Get the Skeptic model instance.
 */
export function getSkepticModel() {
    return bedrock(conductorModel);
}

/**
 * Get the Analyst model instance.
 * Managed models on Bedrock handle large contexts natively, 
 * so no custom fetch/num_ctx wrapper is needed.
 */
export function getAnalystModel() {
    return bedrock(analystModelId);
}

/**
 * Get a specific model by name.
 */
export function getModelById(modelId: string) {
    return bedrock(modelId);
}
