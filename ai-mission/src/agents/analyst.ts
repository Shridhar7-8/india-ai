import { generateText } from "ai";
import { getModel } from "@/lib/ollama";
import { ANALYST_PROMPT } from "./prompts";
import { UnifiedReportSchema, type UnifiedReport } from "@/lib/schemas";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { SkepticSummary } from "./skeptic";

interface AnalystInput {
    conversationHistory: Array<{ role: string; content: string }>;
    skepticSummary: SkepticSummary;
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
    maxTokens: number = 8192,
    temperature: number = 0.1,
): Promise<T | null> {
    const MAX_RETRIES = 5;
    let lastZodError: string | null = null; // Track last Zod error for feedback

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Build prompt — on retry, append the Zod error so the LLM can self-correct
            const stringifiedSchema = JSON.stringify(zodToJsonSchema(schema as any), null, 2);
            let effectivePrompt = userPrompt + `\n\nEXPECTED JSON SCHEMA:\n${stringifiedSchema}`;

            if (lastZodError && attempt > 0) {
                effectivePrompt += `\n\n⚠️ YOUR PREVIOUS ATTEMPT FAILED VALIDATION:\n${lastZodError}\nPlease fix the above issues and try again. Use EXACTLY the allowed values listed above. Output RAW JSON ONLY.`;
                console.log(`🔄 ${chunkName} retry ${attempt + 1} with error feedback`);
            }

            const { text } = await generateText({
                model: getModel(),
                system: systemPrompt,
                prompt: effectivePrompt,
                temperature: temperature,
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

// ─── Post-Generation Validation ─────────────────────────────────────

function validateReportAgainstTranscript(report: UnifiedReport, transcript: string): string[] {
    const warnings: string[] = [];
    const tLower = transcript.toLowerCase();

    const checkArray = (arr: string[] | undefined, fieldName: string) => {
        if (!arr || arr.length === 0) return;
        for (const quote of arr) {
            // Remove basic punctuation/spacing issues for a more forgiving check
            const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();
            const normalizedTranscript = tLower.replace(/\s+/g, ' ');
            if (!normalizedTranscript.includes(normalizedQuote)) {
                warnings.push(`MISSING_EVIDENCE in ${fieldName}: "${quote}" was not found verbatim in the transcript.`);
            }
        }
    };

    checkArray(report.grit_evaluation_evidence, "grit_evaluation_evidence");
    checkArray(report.business_thinking_evidence, "business_thinking_evidence");
    checkArray(report.idea_evidence, "idea_evidence");
    checkArray(report.macro_context_evidence, "macro_context_evidence");
    checkArray(report.development_stage_evidence, "development_stage_evidence");
    checkArray(report.desirability_evidence, "desirability_evidence");
    checkArray(report.viability_evidence, "viability_evidence");
    checkArray(report.feasibility_evidence, "feasibility_evidence");
    checkArray(report.defensibility_evidence, "defensibility_evidence");
    checkArray(report.affordability_evidence, "affordability_evidence");
    checkArray(report.mission_fit_evidence, "mission_fit_evidence");
    checkArray(report.mission_fit_reasoning_evidence, "mission_fit_reasoning_evidence");

    return warnings;
}

// ─── Deterministic Scoring Logic ────────────────────────────────────

function computeDeterministicScores(report: UnifiedReport) {
    const dScore = report.desirability_evaluation.includes("Specific problem clearly defined") ? 5 : report.desirability_evaluation.includes("Problem and target user defined") ? 4 : report.desirability_evaluation.includes("Problem mentioned but too broad") ? 3 : report.desirability_evaluation.includes("Weak problem articulation") ? 2 : 1;
    const vScore = report.viability_evaluation.includes("Clear revenue model") ? 5 : report.viability_evaluation.includes("Solid revenue model") ? 4 : report.viability_evaluation.includes("Revenue model exists but vague") ? 3 : report.viability_evaluation.includes("Revenue model not properly defined") ? 2 : 1;
    const fScore = report.feasibility_evaluation.includes("Technical capability demonstrated") ? 5 : report.feasibility_evaluation.includes("Technical capability evident") ? 4 : report.feasibility_evaluation.includes("Possible to build") ? 3 : report.feasibility_evaluation.includes("Significant technical gaps") ? 2 : 1;
    const defScore = report.defensibility_evaluation.includes("At least ONE strong moat clearly defined") ? 5 : report.defensibility_evaluation.includes("One credible moat identified") ? 4 : report.defensibility_evaluation.includes("Some differentiation exists but can be easily copied") ? 3 : report.defensibility_evaluation.includes("Very weak differentiation") ? 2 : 1;
    const aScore = report.affordability_evaluation.includes("Pricing clearly fits the Indian target segment") ? 5 : report.affordability_evaluation.includes("Pricing fits India well") ? 4 : report.affordability_evaluation.includes("Pricing has not been thought of proactively") ? 3 : report.affordability_evaluation.includes("Pricing not thought through for India") ? 2 : 1;
    
    const gritScore = report.grit_evaluation.includes("Specific failure described in detail") ? 5 : report.grit_evaluation.includes("Specific failure mentioned") ? 4 : report.grit_evaluation.includes("Failure mentioned but vague") ? 3 : report.grit_evaluation.includes("Very vague failure story") ? 2 : 1;
    const missionFitScore = report.mission_fit_evaluation.includes("Direct, specific connection to a pillar") ? 5 : report.mission_fit_evaluation.includes("Clear connection to a pillar") ? 4 : report.mission_fit_evaluation.includes("Connection to a pillar exists") ? 3 : report.mission_fit_evaluation.includes("Pillar fit is a stretch") ? 2 : 1;

    const totalScore = dScore + vScore + fScore + defScore + aScore + gritScore + missionFitScore;

    return {
        desirability: dScore,
        viability: vScore,
        feasibility: fScore,
        defensibility: defScore,
        affordability: aScore,
        grit: gritScore,
        missionFit: missionFitScore,
        total: totalScore
    };
}

// ─── Main Analyst Function ──────────────────────────────────────────

export async function runAnalyst(input: AnalystInput): Promise<string> {
    const { conversationHistory, skepticSummary, companyName, pitchDeckUrl, websiteUrl } = input;

    const transcript = conversationHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    const redFlagsStr = skepticSummary.redFlags.length > 0
        ? skepticSummary.redFlags.map((f) => `- ${f.category}: ${f.description}`).join("\n")
        : "No red flags detected.";

    const greenFlagsStr = skepticSummary.greenFlags.length > 0
        ? skepticSummary.greenFlags.map((f) => `- ${f.category}: ${f.description}`).join("\n")
        : "No green flags detected.";

    const baseContext = `INTERVIEW TRANSCRIPT:\n${transcript}\n\nRED FLAGS DETECTED BY SECONDARY AGENT:\n${redFlagsStr}\n\nGREEN FLAGS DETECTED BY SECONDARY AGENT:\n${greenFlagsStr}`;

    console.log("Generating unified report...");
    const reportData = await callLLMForJSON(
        UnifiedReportSchema,
        "Unified Report",
        ANALYST_PROMPT,
        `${baseContext}\n\nYou must generate the full report based ONLY on the evidence in the transcript. Your response must be valid JSON matching the EXACT top-level structure of the expected schema.`,
        8192,
        0.1 // Temp 0.1 for high determinism
    );

    if (!reportData) {
        return "ERROR: Analyst flow failed to generate a valid report after maximum retries.";
    }

    const warnings = validateReportAgainstTranscript(reportData, transcript);
    if (warnings.length > 0) {
        console.warn("\n⚠️ TRANSCRIPT VALIDATION WARNINGS (Missing Evidence):\n" + warnings.join("\n") + "\n");
    }

    const scores = computeDeterministicScores(reportData);

    return buildMarkdownReport(reportData, scores, warnings, skepticSummary, companyName, pitchDeckUrl, websiteUrl);
}

// ─── Deterministic Markdown Builder ─────────────────────────────────

function buildMarkdownReport(
    report: UnifiedReport,
    scores: ReturnType<typeof computeDeterministicScores>,
    warnings: string[],
    skepticSummary: SkepticSummary,
    companyName?: string,
    pitchDeckUrl?: string,
    websiteUrl?: string,
): string {
    const lines: string[] = [];

    // Title
    const reportDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    lines.push(`# INDIAAI MISSION STARTUP EVALUATION`);
    lines.push(`**${report.founder_name} | ${companyName || "Not specified"} | ${reportDate}**`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 1: Founder Profile
    lines.push("## SECTION 1 — FOUNDER PROFILE");
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Who They Are** | ${report.founder_background} |`);
    lines.push(`| **Why Entrepreneurship** | ${report.why_entrepreneurship} |`);
    lines.push(`| **Financial Commitments** | ${report.financial_commitments} |`);
    lines.push(`| **Goals** | ${report.goals} |`);
    lines.push(`| **Grit Score [ ${scores.grit} / 5 ]** | ${report.grit_evaluation_reasoning} |`);
    lines.push(`| **Business Thinking** | ${report.business_thinking} |`);
    lines.push(`| **Founder Structure** | ${report.founder_structure} |`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 2: Solution Snapshot
    lines.push("## SECTION 2 — SOLUTION SNAPSHOT");
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Idea** | ${report.idea} |`);
    lines.push(`| **Macro Context** | ${report.macro_context} |`);
    lines.push(`| **Development Stage** | ${report.development_stage} |`);
    
    // Assets
    let pitchStr = "NO";
    if (pitchDeckUrl) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const fullUrl = `${supabaseUrl}/storage/v1/object/public/pitch-decks/${pitchDeckUrl}`;
        pitchStr = `YES ([LINK](${fullUrl}))`;
    }
    let webStr = "NO";
    if (websiteUrl && websiteUrl !== "Not provided") {
        const fullWebUrl = websiteUrl.startsWith("http") ? websiteUrl : "https://" + websiteUrl;
        webStr = `YES ([LINK](${fullWebUrl}))`;
    }
    lines.push(`| **Assets** | Pitch deck: ${pitchStr} \\| Website: ${webStr} |`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 3: 5-Zone Scorecard
    lines.push("## SECTION 3 — 5-ZONE SCORECARD");
    lines.push("");
    lines.push("| Zone | Score | Analyst Note |");
    lines.push("|---|---|---|");
    lines.push(`| **Desirability** | **${scores.desirability} / 5** | ${report.desirability_note} |`);
    lines.push(`| **Viability & Scalability** | **${scores.viability} / 5** | ${report.viability_note} |`);
    lines.push(`| **Feasibility** | **${scores.feasibility} / 5** | ${report.feasibility_note} |`);
    lines.push(`| **Defensibility** | **${scores.defensibility} / 5** | ${report.defensibility_note} |`);
    lines.push(`| **Affordability** | **${scores.affordability} / 5** | ${report.affordability_note} |`);
    const totalZoneScore = scores.desirability + scores.viability + scores.feasibility + scores.defensibility + scores.affordability;
    lines.push(`| **TOTAL** | **${totalZoneScore} / 25** | |`);
    lines.push("");

    if (scores.desirability <= 2) {
        lines.push("> ⚠️ **DESIRABILITY GATE:** If Desirability scores 1 or 2, flag prominently here and in the Overall Summary — a product without a credible market cannot become a viable business regardless of other zone scores.");
        lines.push("");
    }
    lines.push("---");
    lines.push("");

    // Section 4: Flags
    lines.push("## SECTION 4 — FLAGS");
    lines.push("");
    lines.push("| 🔴 RED FLAGS | 🟢 GREEN FLAGS |");
    lines.push("|---|---|");
    
    // Format flags using SkepticSummary
    const buildFlagItem = (f: { category: string, description: string, _evidence: string[] }) => {
        const evidenceStr = f._evidence && f._evidence.length > 0 
            ? `<br> *Evidence:* "${f._evidence.join('" / "')}"` 
            : "";
        return `<li>**${f.category}:** ${f.description}${evidenceStr}</li>`;
    };

    const rDisplay = skepticSummary.redFlags.length > 0 
        ? "<ul>" + skepticSummary.redFlags.map(buildFlagItem).join("\n") + "</ul>" 
        : "None detected.";
        
    const gDisplay = skepticSummary.greenFlags.length > 0 
        ? "<ul>" + skepticSummary.greenFlags.map(buildFlagItem).join("\n") + "</ul>" 
        : "None detected.";
    
    lines.push(`| ${rDisplay} | ${gDisplay} |`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 5: AI Mission Fit Score
    lines.push("## SECTION 5 — AI MISSION Fit SCORE");
    lines.push("");
    lines.push(`**AI Mission Fit Score: ${scores.missionFit} / 5**`);
    lines.push("");
    let pillarPrint: string = report.indiaai_pillar;
    // Strip the number prefix if there is one e.g "1 — "
    if (pillarPrint && pillarPrint.includes("—")) {
        pillarPrint = pillarPrint.split("—")[1].trim();
    }
    lines.push(`**IndiaAI Pillar:** ${pillarPrint}`);
    lines.push("");
    lines.push(`**Reasoning:**`);
    lines.push(`${report.mission_fit_reasoning}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 6: Final Score & Overall Summary
    lines.push("## SECTION 6 — FINAL SCORE & OVERALL SUMMARY");
    lines.push("");
    lines.push("| | Score |");
    lines.push("|---|---|");
    lines.push(`| Desirability *(Zone 1)* | ${scores.desirability} / 5 |`);
    lines.push(`| Viability & Scalability *(Zone 2)* | ${scores.viability} / 5 |`);
    lines.push(`| Feasibility *(Zone 3)* | ${scores.feasibility} / 5 |`);
    lines.push(`| Defensibility *(Zone 4)* | ${scores.defensibility} / 5 |`);
    lines.push(`| Affordability *(Zone 5)* | ${scores.affordability} / 5 |`);
    lines.push(`| Grit Score | ${scores.grit} / 5 |`);
    lines.push(`| AI Mission Fit Score | ${scores.missionFit} / 5 |`);
    lines.push(`| **FINAL SCORE** | **${scores.total} / 35** |`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("**OVERALL SUMMARY**");
    lines.push("");
    if (scores.desirability <= 2) {
        lines.push(`**[DESIRABILITY GATE FAILED]:** ` + report.overall_summary);
    } else {
        lines.push(report.overall_summary);
    }
    lines.push("");
    if (warnings.length > 0) {
        lines.push("---");
        lines.push("**System Note:** The AI Analyst generated the following citation warnings during evaluation:");
        warnings.forEach(w => lines.push(`- *${w}*`));
        lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push("*END OF REPORT*");

    return lines.join("\n");
}
