import { generateText } from "ai";
import { getSkepticModel } from "@/lib/ollama";
import { SKEPTIC_PROMPT } from "./prompts";

interface SkepticInput {
    userMessage: string;
    currentTopic: string;
    conversationHistory: Array<{ role: string; content: string }>;
    existingRedFlags: Array<{ category: string; description: string }>;
}

interface RedFlag {
    category: string;
    description: string;
}

/**
 * Run the Skeptic agent: analyze the user's latest response for red flags.
 * Returns an array of newly detected red flags (may be empty).
 */
export async function runSkeptic(input: SkepticInput): Promise<RedFlag[]> {
    const { userMessage, currentTopic, conversationHistory, existingRedFlags } = input;

    // Build context for the Skeptic
    const recentHistory = conversationHistory.slice(-10);
    const historyStr = recentHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const existingFlagsStr = existingRedFlags.length > 0
        ? existingRedFlags
            .map((f, i) => `${i + 1}. RED FLAG - ${f.category}: ${f.description}`)
            .join("\n")
        : "No red flags detected yet.";

    const prompt = `
CURRENT TOPIC BEING DISCUSSED: ${currentTopic}

EXISTING RED FLAGS:
${existingFlagsStr}

RECENT CONVERSATION:
${historyStr}

USER'S LATEST RESPONSE: ${userMessage}

Analyze the user's latest response. Return a JSON array of any NEW red flags detected.
If no new red flags, return an empty array [].
`.trim();

    try {
        const { text } = await generateText({
            model: getSkepticModel(),
            system: SKEPTIC_PROMPT,
            prompt,
            temperature: 0.3,
            maxOutputTokens: 1024,
        });

        // Parse JSON array from response
        let jsonStr = text.trim();

        // Remove markdown code block if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Find array bounds
        const firstBracket = jsonStr.indexOf("[");
        const lastBracket = jsonStr.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        } else {
            // LLM returned prose instead of JSON — no red flags
            return [];
        }

        const parsed = JSON.parse(jsonStr);

        if (!Array.isArray(parsed)) return [];

        // Validate each red flag
        return parsed
            .filter(
                (f: Record<string, unknown>) =>
                    typeof f.category === "string" && typeof f.description === "string"
            )
            .map((f: Record<string, unknown>) => ({
                category: String(f.category),
                description: String(f.description),
            }));
    } catch (error) {
        console.error("⚠️ Skeptic parse error (non-critical):", error);
        return [];
    }
}
