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

/** Normalize text for fuzzy comparison: lowercase, strip punctuation, collapse whitespace. */
function normalizeForMatch(s: string): string {
    return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Check if a quote is grounded in the transcript using a two-tier strategy:
 * 1. Normalized substring match (handles punctuation/casing differences).
 * 2. Word-overlap fallback: ≥70% of significant words (length > 3) appear in the transcript.
 */
function isEvidenceGrounded(quote: string, normalizedTranscript: string): boolean {
    const normalizedQuote = normalizeForMatch(quote);
    if (!normalizedQuote) return false;

    // Tier 1: normalized substring
    if (normalizedTranscript.includes(normalizedQuote)) return true;

    // Tier 2: word overlap — check significant words (length > 3)
    const words = normalizedQuote.split(" ").filter(w => w.length > 3);
    if (words.length === 0) return false;
    const matchCount = words.filter(w => normalizedTranscript.includes(w)).length;
    return matchCount / words.length >= 0.7;
}

function validateEvidenceAgainstTranscript(
    flags: Array<RedFlag | GreenFlag>,
    conversationHistory: Array<{ role: string; content: string }>
): Array<RedFlag | GreenFlag> {
    const normalizedTranscript = normalizeForMatch(
        conversationHistory
            .filter(m => m.role === "user")
            .map(m => m.content)
            .join(" ")
    );

    return flags.filter(flag => {
        if (!flag._evidence || !Array.isArray(flag._evidence) || flag._evidence.length === 0) return false;
        return flag._evidence.every(quote => isEvidenceGrounded(quote, normalizedTranscript));
    });
}

const RED_FLAG_CATEGORIES = ["LOGIC_GAP", "VAGUE_FLUFF", "EVASION", "SHALLOW_DEPTH", "CLARITY_GAP", "AI_WASHING"] as const;
const GREEN_FLAG_CATEGORIES = [
    "Problem Clarity", "Commercial Awareness", "Ecosystem Thinking",
    "Domain Expertise", "India-First Design", "AI Conviction",
    "Grit Signal", "Prior Build Experience", "Honest Self-Awareness",
] as const;

/**
 * Map LLM-generated category names to the canonical form defined in the prompt.
 * Handles casing/spacing/underscore variants (e.g. "AI_Conviction" → "AI Conviction",
 * "EcosystemThinking" → "Ecosystem Thinking").
 */
function normalizeCategory(category: string, type: "red" | "green"): string {
    const norm = (s: string) => s.toLowerCase().replace(/[\s_]/g, "");
    const candidates = type === "red" ? RED_FLAG_CATEGORIES : GREEN_FLAG_CATEGORIES;
    return (candidates as readonly string[]).find(c => norm(c) === norm(category)) ?? category;
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

        // --- NEW: Robust JSON Cleanup ---
        // Strip trailing commas from objects and arrays: [1, 2,] -> [1, 2]
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1'); 
        // --------------------------------

        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error("❌ [SKEPTIC] Failed to parse JSON after cleanup:", e);
            console.log("Context:", jsonStr);
            return { redFlags: [], greenFlags: [] };
        }

        if (!Array.isArray(parsed)) return { redFlags: [], greenFlags: [] };

        // Structure the raw flags
        const rawFlags = parsed.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (f: any) => typeof f.type === "string" && typeof f.category === "string" && typeof f.description === "string"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ).map((f: any) => ({
            type: f.type,
            category: normalizeCategory(String(f.category), f.type as "red" | "green"),
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
