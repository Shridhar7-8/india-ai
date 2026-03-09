import { generateText } from "ai";
import { getModel } from "@/lib/ollama";
import { ANALYST_PROMPT } from "./prompts";
import {
    FounderChunkSchema,
    SolutionChunkSchema,
    ScorecardChunkSchema,
    FlagsChunkSchema,
    VerdictChunkSchema,
} from "@/lib/schemas";
import type { z } from "zod";

interface AnalystInput {
    conversationHistory: Array<{ role: string; content: string }>;
    redFlags: Array<{ category: string; description: string }>;
    companyName?: string;
    pitchDeckUrl?: string;
    websiteUrl?: string;
    vagueTopics?: string[];
}

// ─── JSON Repair Helper ─────────────────────────────────────────────

function tryRepairJSON(raw: string): string {
    let s = raw.trim();

    // Strip markdown fencing if present
    const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) s = fenceMatch[1].trim();

    // Extract from first { to last }
    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");

    if (firstBrace === -1) return s; // no JSON at all

    if (lastBrace > firstBrace) {
        s = s.substring(firstBrace, lastBrace + 1);
    } else {
        // No closing brace found — truncated JSON
        s = s.substring(firstBrace);

        // Try to close open strings and braces
        const quoteCount = (s.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            s += '"';
        }

        // Close unclosed braces/brackets
        const openBraces = (s.match(/{/g) || []).length;
        const closeBraces = (s.match(/}/g) || []).length;
        const openBrackets = (s.match(/\[/g) || []).length;
        const closeBrackets = (s.match(/]/g) || []).length;

        for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) s += "}";
    }

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, "$1");

    return s;
}

// ─── Generic LLM JSON Call with Zod + Auto-Retry ────────────────────

async function callLLMForJSON<T>(
    schema: z.ZodType<T>,
    chunkName: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 2048,
): Promise<T | null> {
    const MAX_RETRIES = 5;
    let lastZodError: string | null = null; // Track last Zod error for feedback

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Build prompt — on retry, append the Zod error so the LLM can self-correct
            let effectivePrompt = userPrompt;
            if (lastZodError && attempt > 0) {
                effectivePrompt += `\n\n⚠️ YOUR PREVIOUS ATTEMPT FAILED VALIDATION:\n${lastZodError}\nPlease fix the above issues and try again. Use EXACTLY the allowed values listed above. Output RAW JSON ONLY.`;
                console.log(`🔄 ${chunkName} retry ${attempt + 1} with error feedback`);
            }

            const { text } = await generateText({
                model: getModel(),
                system: systemPrompt,
                prompt: effectivePrompt,
                temperature: 0.3,
                maxOutputTokens: maxTokens,
            });

            console.log(`📊 ${chunkName} (attempt ${attempt + 1}, ${text.length} chars)`);

            if (!text || text.trim().length === 0) {
                console.warn(`⚠️ Empty ${chunkName} response (attempt ${attempt + 1})`);
                continue;
            }

            // Log first 200 chars for debugging
            console.log(`   Raw start: ${text.substring(0, 200)}...`);

            // Try to repair and parse JSON
            const jsonStr = tryRepairJSON(text);
            const parsed = JSON.parse(jsonStr);
            const zodResult = schema.safeParse(parsed);

            if (!zodResult.success) {
                const flatError = zodResult.error.flatten();
                console.warn(`⚠️ ${chunkName} Zod failed (attempt ${attempt + 1}):`, flatError);
                // Store the error for the next retry prompt
                lastZodError = JSON.stringify(flatError.fieldErrors);
                continue;
            }

            console.log(`✅ ${chunkName} validated on attempt ${attempt + 1}`);
            return zodResult.data;

        } catch (error) {
            console.error(`❌ ${chunkName} error (attempt ${attempt + 1}):`, error);
            lastZodError = error instanceof Error ? error.message : String(error);
        }
    }

    console.error(`❌ All ${MAX_RETRIES} ${chunkName} attempts failed.`);
    return null;
}

// ─── 7 IndiaAI Pillars (names only — keeping prompt small) ──────────

const INDIAAI_PILLAR_NAMES = `Pick EXACTLY ONE pillar:
1. IndiaAI Innovation Centre
2. IndiaAI Application Development Initiative
3. AIKosh
4. IndiaAI Compute Capacity
5. IndiaAI Startup Financing
6. IndiaAI FutureSkills
7. Safe & Trusted AI
8. None`;

// ─── Main Analyst Function ──────────────────────────────────────────

export async function runAnalyst(input: AnalystInput): Promise<string> {
    const { conversationHistory, redFlags, companyName, pitchDeckUrl, websiteUrl } = input;

    const transcript = conversationHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    // Pass only descriptions — not category codes like VAGUE_FLUFF
    const redFlagsStr = redFlags.length > 0
        ? redFlags.map((f, i) => `${i + 1}. ${f.description}`).join("\n")
        : "No red flags detected.";

    const baseContext = `INTERVIEW TRANSCRIPT:\n${transcript}\n\nRED FLAGS:\n${redFlagsStr}`;

    // ── Call 1: Founder Profile ──
    const founderData = await callLLMForJSON(
        FounderChunkSchema,
        "Founder chunk",
        ANALYST_PROMPT,
        `${baseContext}\n\nAnalyze the transcript and return a JSON with ONLY these fields:\n{\n  "founder_name": "full name",\n  "founder_background": "1-2 line summary (education, experience)",\n  "why_entrepreneurship": "why they chose entrepreneurship",\n  "financial_commitments": "personal/family financial obligations, or 'None'",\n  "goals": "short-term, mid-term, and long-term goals as ONE string",\n  "grit_score": "HIGH or MEDIUM or LOW",\n  "grit_evidence": "1-2 sentences justifying grit score",\n  "business_thinking": "how they view startup as a business",\n  "founder_structure": "Solo founder OR Co-founder team"\n}\nOutput RAW JSON ONLY.`,
    );

    // ── Call 2: Solution Snapshot ──
    const solutionData = await callLLMForJSON(
        SolutionChunkSchema,
        "Solution chunk",
        ANALYST_PROMPT,
        `${baseContext}\n\nAnalyze the transcript and return a JSON with ONLY these fields:\n{\n  "idea": "2-3 sentences describing the startup idea (stay close to their words)",\n  "macro_context": "1-line macro context",\n  "why_ai": "why their product requires AI",\n  "development_stage": "MUST be exactly one of: Idea, Concept, Prototype, Early MVP, MVP, Growth, Not specified",\n  "assets": "key assets they bring"\n}\nOutput RAW JSON ONLY.`,
    );

    // ── Call 3: 5-Zone Scorecard ──
    const scorecardData = await callLLMForJSON(
        ScorecardChunkSchema,
        "Scorecard chunk",
        ANALYST_PROMPT,
        `${baseContext}\n\nScore each zone. Return a JSON with ONLY these fields:\n{\n  "desirability_score": "PASS or MODERATE or FAIL",\n  "desirability_note": "1 line analyst note",\n  "viability_score": "PASS or MODERATE or FAIL",\n  "viability_note": "1 line analyst note",\n  "feasibility_score": "PASS or MODERATE or FAIL",\n  "feasibility_note": "1 line analyst note",\n  "defensibility_score": "PASS or MODERATE or FAIL",\n  "defensibility_note": "1 line analyst note",\n  "affordability_score": "PASS or MODERATE or FAIL",\n  "affordability_note": "1 line analyst note"\n}\nScoring: PASS=strong evidence, MODERATE=partial evidence, FAIL=no evidence or missing.\nOutput RAW JSON ONLY.`,
    );

    // ── Build scorecard summary for verdict context ──
    const sc = scorecardData;
    const scorecardSummary = sc
        ? `SCORECARD: Desirability=${sc.desirability_score}, Viability=${sc.viability_score}, Feasibility=${sc.feasibility_score}, Defensibility=${sc.defensibility_score}, Affordability=${sc.affordability_score}`
        : "SCORECARD: Not available";

    const gritSummary = founderData
        ? `GRIT SCORE: ${founderData.grit_score}`
        : "GRIT SCORE: Not available";

    // ── Call 4a: Flags (red flags, green flags, mission fit) ──
    const flagsData = await callLLMForJSON(
        FlagsChunkSchema,
        "Flags chunk",
        ANALYST_PROMPT,
        `${baseContext}\n\n${scorecardSummary}\n${gritSummary}\n\nReturn a JSON with ONLY these 3 fields:\n{\n  "red_flags": "flag1 | flag2 | flag3 (pipe-separated, or 'None')",\n  "green_flags": "flag1 | flag2 | flag3 (pipe-separated, or 'None')",\n  "mission_fit": "HIGH or MEDIUM or LOW"\n}\nOutput RAW JSON ONLY.`,
    );

    const missionFit = flagsData?.mission_fit || "LOW";

    // ── Call 4b: Verdict (pillar, awareness, reasoning, verdict) ──
    // Deterministic hard-disqualifier check BEFORE the LLM call
    const zoneScores = sc ? [sc.desirability_score, sc.viability_score, sc.feasibility_score, sc.defensibility_score, sc.affordability_score] : [];
    const failCount = zoneScores.filter(z => z === "FAIL").length;
    const passCount = zoneScores.filter(z => z === "PASS").length;
    const desirabilityFail = sc?.desirability_score === "FAIL";
    const gritScore = founderData?.grit_score || "LOW";

    // Pre-compute the deterministic verdict so the LLM can only fill in reasoning + pillar
    let deterministicVerdict: string;
    if (failCount >= 3 || desirabilityFail) {
        // HARD DISQUALIFIER
        deterministicVerdict = "DOESN'T SEEM LIKE A GOOD FIT";
    } else if (
        (gritScore === "HIGH" || gritScore === "MEDIUM") &&
        passCount >= 3 && failCount === 0 &&
        (missionFit === "HIGH" || missionFit === "MEDIUM")
    ) {
        deterministicVerdict = "SEEMS LIKE A GOOD FIT";
    } else if (
        (gritScore === "HIGH" || gritScore === "MEDIUM") &&
        passCount >= 2 && failCount <= 2 && !desirabilityFail
    ) {
        deterministicVerdict = "UNSURE — MORE VALIDATION REQUIRED";
    } else if (gritScore === "LOW" || failCount >= 3) {
        deterministicVerdict = "DOESN'T SEEM LIKE A GOOD FIT";
    } else {
        deterministicVerdict = "UNSURE — MORE VALIDATION REQUIRED";
    }

    const hardDisqualifierNote = desirabilityFail
        ? "HARD DISQUALIFIER: Desirability is FAIL — no market exists for the product. The verdict MUST be DOESN'T SEEM LIKE A GOOD FIT. Mention this explicitly in verdict_reasoning."
        : failCount >= 3
            ? `HARD DISQUALIFIER: ${failCount} zones scored FAIL (≥3). The verdict MUST be DOESN'T SEEM LIKE A GOOD FIT regardless of everything else.`
            : "";

    const verdictData = await callLLMForJSON(
        VerdictChunkSchema,
        "Verdict chunk",
        ANALYST_PROMPT,
        `${baseContext}\n\n${scorecardSummary}\n${gritSummary}\nMISSION FIT: ${missionFit}\nPASS count: ${passCount}, FAIL count: ${failCount}\n${hardDisqualifierNote}\n\n${INDIAAI_PILLAR_NAMES}\n\nThe VERDICT has been determined as: "${deterministicVerdict}"\nYou MUST use this exact verdict string. Do NOT change it.\n\nReturn a JSON with ONLY these 5 fields:\n{\n  "indiaai_pillar": "one pillar name from the list above, or None",\n  "indiaai_awareness": "Aware or Not aware",\n  "mission_fit_reasoning": "1-2 sentences why",\n  "verdict": "${deterministicVerdict}",\n  "verdict_reasoning": "3-4 sentences. Reference Founder Grit, Scorecard, Mission Fit, and any flags that drove the decision."\n}\n\nOutput RAW JSON ONLY.`,
        3072, // extra tokens for reasoning fields
    );

    // ── Merge & Build Markdown ──
    return buildMarkdownReport(founderData, solutionData, scorecardData, flagsData, verdictData, companyName, pitchDeckUrl, websiteUrl);
}

// ─── Deterministic Markdown Builder ─────────────────────────────────

function buildMarkdownReport(
    founder: z.infer<typeof FounderChunkSchema> | null,
    solution: z.infer<typeof SolutionChunkSchema> | null,
    scorecard: z.infer<typeof ScorecardChunkSchema> | null,
    flags: z.infer<typeof FlagsChunkSchema> | null,
    verdict: z.infer<typeof VerdictChunkSchema> | null,
    companyName?: string,
    pitchDeckUrl?: string,
    websiteUrl?: string,
): string {
    const f = founder || {
        founder_name: "Unknown", founder_background: "Not available",
        why_entrepreneurship: "Not available", financial_commitments: "Not available",
        goals: "Not available", grit_score: "LOW" as const, grit_evidence: "Report generation partially failed.",
        business_thinking: "Not available", founder_structure: "Not available",
    };
    const s = solution || {
        idea: "Not available", macro_context: "Not available",
        why_ai: "Not available", development_stage: "Not available", assets: "Not available",
    };
    const sc = scorecard || {
        desirability_score: "FAIL" as const, desirability_note: "Report generation failed",
        viability_score: "FAIL" as const, viability_note: "Report generation failed",
        feasibility_score: "FAIL" as const, feasibility_note: "Report generation failed",
        defensibility_score: "FAIL" as const, defensibility_note: "Report generation failed",
        affordability_score: "FAIL" as const, affordability_note: "Report generation failed",
    };
    const fl = flags || {
        red_flags: "Report generation partially failed", green_flags: "None",
        mission_fit: "LOW" as const,
    };
    const v = verdict || {
        indiaai_pillar: "None" as const,
        indiaai_awareness: "Not available", mission_fit_reasoning: "Report generation partially failed.",
        verdict: "DOESN'T SEEM LIKE A GOOD FIT" as const, verdict_reasoning: "Report generation partially failed.",
    };

    const lines: string[] = [];

    // Title: Applicant Name | Company Name | Date
    const reportDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    lines.push(`# BUILDAI PITCH EVENT STARTUP EVALUATION | ${f.founder_name} | ${companyName || "Not specified"} | ${reportDate}`);
    lines.push("");

    // Section 1
    lines.push("## SECTION 1 — FOUNDER PROFILE");
    lines.push("");
    lines.push("| Field | Details |");
    lines.push("|---|---|");
    lines.push(`| **Who They Are** | ${f.founder_background} |`);
    lines.push(`| **Why Entrepreneurship** | ${f.why_entrepreneurship} |`);
    lines.push(`| **Financial Commitments** | ${f.financial_commitments} |`);
    lines.push(`| **Goals** | ${f.goals} |`);
    lines.push(`| **Grit Score** | ${f.grit_score} <br><br> Evidence: ${f.grit_evidence} |`);
    lines.push(`| **Business Thinking** | ${f.business_thinking} |`);
    lines.push(`| **Founder Structure** | ${f.founder_structure} |`);
    lines.push("");

    // Section 2
    lines.push("## SECTION 2 — SOLUTION SNAPSHOT");
    lines.push("");
    lines.push("| Field | Details |");
    lines.push("|---|---|");
    lines.push(`| **IDEA** | ${s.idea} |`);
    lines.push(`| **Macro context** | ${s.macro_context} |`);
    lines.push(`| **Why AI** | ${s.why_ai} |`);
    lines.push(`| **Development Stage** | ${s.development_stage} |`);
    lines.push(`| **Assets** | ${s.assets} |`);
    // Pitch deck & website as table rows in Solution Snapshot
    if (pitchDeckUrl) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const fullUrl = `${supabaseUrl}/storage/v1/object/public/pitch-decks/${pitchDeckUrl}`;
        lines.push(`| **Pitch Deck** | [${pitchDeckUrl.split("/").pop() || "View Pitch Deck"}](${fullUrl}) |`);
    } else {
        lines.push(`| **Pitch Deck** | Not provided |`);
    }
    lines.push(`| **Website** | ${websiteUrl || "Not provided"} |`);
    lines.push("");

    // Section 3
    lines.push("## SECTION 3 — 5-ZONE SCORECARD [PASS / MODERATE / FAIL]");
    lines.push("");
    lines.push("| Zone | Score | Analyst Note |");
    lines.push("|---|---|---|");
    lines.push(`| Desirability | ${sc.desirability_score} | ${sc.desirability_note} |`);
    lines.push(`| Viability and Scalability | ${sc.viability_score} | ${sc.viability_note} |`);
    lines.push(`| Feasibility | ${sc.feasibility_score} | ${sc.feasibility_note} |`);
    lines.push(`| Defensibility | ${sc.defensibility_score} | ${sc.defensibility_note} |`);
    lines.push(`| Affordability | ${sc.affordability_score} | ${sc.affordability_note} |`);
    lines.push("");

    // Section 4 — Flags as bullet points
    lines.push("## SECTION 4 — FLAGS");
    lines.push("");
    lines.push("### 🔴 RED FLAGS");
    const redItems = fl.red_flags.split("|").map(f => f.trim()).filter(f => f && f !== "None");
    if (redItems.length > 0) {
        redItems.forEach(flag => lines.push(`- ${flag}`));
    } else {
        lines.push("- None");
    }
    lines.push("");
    lines.push("### 🟢 GREEN FLAGS");
    const greenItems = fl.green_flags.split("|").map(f => f.trim()).filter(f => f && f !== "None");
    if (greenItems.length > 0) {
        greenItems.forEach(flag => lines.push(`- ${flag}`));
    } else {
        lines.push("- None");
    }
    lines.push("");

    // Section 5
    lines.push(`## SECTION 5 — AI MISSION FIT [HIGH / MEDIUM / LOW]`);
    lines.push("");
    lines.push(`**Mission Fit:** ${fl.mission_fit}`);
    lines.push("");
    lines.push(`**IndiaAI Pillar:** ${v.indiaai_pillar}`);
    lines.push("");
    lines.push(`**IndiaAI Mission Awareness:** ${v.indiaai_awareness}`);
    lines.push("");
    lines.push(`**Reasoning:** ${v.mission_fit_reasoning}`);
    lines.push("");

    // Section 6
    lines.push(`## SECTION 6 — AI VERDICT (SEEMS LIKE A GOOD FIT / UNSURE — MORE VALIDATION REQUIRED / DOESN'T SEEM LIKE A GOOD FIT) [${v.verdict}]`);
    lines.push("");
    lines.push(`**Verdict:** ${v.verdict}`);
    lines.push("");
    lines.push(`**Reasoning:** ${v.verdict_reasoning}`);
    lines.push("");
    lines.push("END OF REPORT");

    return lines.join("\n");
}
