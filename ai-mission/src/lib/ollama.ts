import { createOpenAI } from "@ai-sdk/openai";

// The user's Ollama is exposed via the OpenAI-compatible endpoint (/v1)
// So we use @ai-sdk/openai with a custom base URL pointing to Ollama
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://103.42.51.87/v1";
const defaultModel = process.env.LLM_MODEL || "nemotron-3-nano:30b";
const skepticModel = process.env.SKEPTIC_MODEL || defaultModel;

const ollama = createOpenAI({
    baseURL: ollamaBaseUrl,
    apiKey: "ollama", // Ollama doesn't need a real API key
});

/**
 * Get the default Ollama language model instance for the AI SDK.
 */
export function getModel() {
    return ollama(defaultModel);
}

/**
 * Get the Skeptic-specific model (may differ from default).
 */
export function getSkepticModel() {
    return ollama(skepticModel);
}

/**
 * Get a specific model by name.
 */
export function getModelById(modelId: string) {
    return ollama(modelId);
}
