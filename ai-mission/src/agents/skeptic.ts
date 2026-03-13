import { generateText } from "ai";
import { getSkepticModel } from "@/lib/bedrock";
import { SKEPTIC_PROMPT } from "./prompts";

export interface RedFlag {
    category: string;
    description: string;
    _evidence: string[];
}

export interface GreenFlag {
    category: string;
    description: string;
    _evidence: string[];
}

export interface SkepticFindings {
    redFlags: RedFlag[];
    greenFlags: GreenFlag[];
}

export interface SkepticInput {
    userMessage: string;
    currentTopic: string;
    conversationHistory: Array<{ role: string; content: string }>;
    existingRedFlags: RedFlag[];
    existingGreenFlags: GreenFlag[];
}

export interface SkepticSummary {
    redFlags: RedFlag[];
    greenFlags: GreenFlag[];
    flagCount: {
        red: number;
        green: number;
    };
}

function validateEvidenceAgainstTranscript(
    flags: Array<RedFlag | GreenFlag>,
    conversationHistory: Array<{ role: string; content: string }>
): Array<RedFlag | GreenFlag> {
    const fullTranscript = conversationHistory
        .filter(m => m.role === "user")
        .map(m => m.content)
        .join(" ")
        .toLowerCase();

    return flags.filter(flag => {
        if (!flag._evidence || !Array.isArray(flag._evidence) || flag._evidence.length === 0) return false;

        // Every quote in _evidence must exist in the transcript
        return flag._evidence.every(quote =>
            fullTranscript.includes(quote.toLowerCase().trim())
        );
    });
}

function deduplicateFlags<T extends { category: string; description: string; _evidence: string[] }>(
    flags: T[]
): T[] {
    const seen = new Map<string, T>();

    for (const flag of flags) {
        const key = `${flag.category}::${flag.description}`;
        if (seen.has(key)) {
            // Merge evidence arrays — keep unique quotes
            const existing = seen.get(key)!;
            const mergedEvidence = Array.from(new Set([
                ...(existing._evidence || []),
                ...(flag._evidence || [])
            ]));
            seen.set(key, { ...existing, _evidence: mergedEvidence });
        } else {
            seen.set(key, flag);
        }
    }

    return Array.from(seen.values());
}

export function buildSkepticSummary(
    allRedFlags: RedFlag[],
    allGreenFlags: GreenFlag[]
): SkepticSummary {
    const uniqueRed = deduplicateFlags(allRedFlags);
    const uniqueGreen = deduplicateFlags(allGreenFlags);

    return {
        redFlags: uniqueRed,
        greenFlags: uniqueGreen,
        flagCount: {
            red: uniqueRed.length,
            green: uniqueGreen.length
        }
    };
}

/**
 * Run the Skeptic agent: analyze the user's latest response for red and green flags.
 * Returns an object containing arrays of newly detected verified flags (may be empty).
 */
export async function runSkeptic(input: SkepticInput): Promise<SkepticFindings> {
    const { userMessage, currentTopic, conversationHistory, existingRedFlags, existingGreenFlags } = input;

    // Build context for the Skeptic
    const recentHistory = conversationHistory.slice(-10);
    const historyStr = recentHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const existingRedFlagsStr = existingRedFlags.length > 0
        ? existingRedFlags.map((f, i) => `${i + 1}. RED FLAG - ${f.category}: ${f.description}`).join("\n")
        : "No red flags detected yet.";

    const existingGreenFlagsStr = existingGreenFlags.length > 0
        ? existingGreenFlags.map((f, i) => `${i + 1}. GREEN FLAG - ${f.category}: ${f.description}`).join("\n")
        : "No green flags detected yet.";

    const prompt = `
CURRENT TOPIC BEING DISCUSSED: ${currentTopic}

EXISTING DETECTED FLAGS:
${existingRedFlagsStr}
${existingGreenFlagsStr}

RECENT CONVERSATION:
${historyStr}

USER'S LATEST RESPONSE: ${userMessage}

Analyze the user's latest response. Return a JSON array of any NEW red flags and NEW green flags detected.
If no new flags, return an empty array [].
`.trim();

    try {
        const { text } = await generateText({
            model: getSkepticModel(),
            system: SKEPTIC_PROMPT,
            prompt,
            temperature: 0.1,
            maxOutputTokens: 2000,
        });

        // Parse JSON array from response
        let jsonStr = text.trim();

        // Remove markdown code block if present
        const jsonMatch = jsonStr.match(/`{3}(?:json)?\\s*([\\s\\S]*?)`{3}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Find array bounds
        const firstBracket = jsonStr.indexOf("[");
        const lastBracket = jsonStr.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        } else {
            // LLM returned prose instead of JSON
            return { redFlags: [], greenFlags: [] };
        }

        const parsed = JSON.parse(jsonStr);

        if (!Array.isArray(parsed)) return { redFlags: [], greenFlags: [] };

        // Structure the raw flags
        const rawFlags = parsed.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (f: any) => typeof f.type === "string" && typeof f.category === "string" && typeof f.description === "string"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ).map((f: any) => ({
            type: f.type,
            category: String(f.category),
            description: String(f.description),
            _evidence: Array.isArray(f._evidence) ? f._evidence.map(String) : [],
        }));

        // Validate the evidence against the transcript
        const validatedFlags = validateEvidenceAgainstTranscript(rawFlags, conversationHistory);

        // Separate red and green
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redFlags: RedFlag[] = validatedFlags.filter(f => (f as any).type === "red").map(f => ({
            category: f.category,
            description: f.description,
            _evidence: f._evidence
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const greenFlags: GreenFlag[] = validatedFlags.filter(f => (f as any).type === "green").map(f => ({
            category: f.category,
            description: f.description,
            _evidence: f._evidence
        }));

        return { redFlags, greenFlags };

    } catch (error) {
        console.error("⚠️ Skeptic parse error (non-critical):", error);
        return { redFlags: [], greenFlags: [] };
    }
}
