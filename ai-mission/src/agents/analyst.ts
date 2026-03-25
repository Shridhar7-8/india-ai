import { generateText } from "ai";
import { getAnalystModel } from "@/lib/bedrock";
import { ANALYST_PROMPT } from "./prompts";
import { type UnifiedReport } from "@/lib/schemas";
import { z } from "zod";
import type { SkepticSummary } from "./skeptic";

// ─── Enum Score Maps (code → full description) ─────────────────────

// Failure Story / Grit — out of 2 marks
const GRIT_MAP: Record<string, string> = {
    "2":   "Specific failure described in detail. Concrete recovery actions taken. Clear lesson learned that visibly shaped how they think or work today.",
    "1.5": "Specific failure mentioned with mostly concrete recovery. Lesson articulated, may lack full depth but shows genuine reflection.",
    "0.5": "Failure mentioned but vague on recovery steps and lessons learned.",
    "0":   "No failure story or very vague failure story. Topic avoided. No evidence of recovery, resilience or learning.",
    "not_discussed": "Not specified",
};

// Team Division — out of 1 mark
const TEAM_DIVISION_MAP: Record<string, string> = {
    "1":   "2 or 3 total co-founders.",
    "0.5": "4 or more total co-founders.",
    "0":   "Solo founder. No co-founders.",
};

// Financial Commitments — out of 1 mark
const FINANCIAL_EVAL_MAP: Record<string, string> = {
    "1": "No financial commitments or obligations.",
    "0": "Financial commitments or obligations exist.",
};

// Business Thinking — out of 1 mark
const BUSINESS_THINKING_MAP: Record<string, string> = {
    "1": "Founder clearly explains how a startup is about running, operating and growing a business beyond just technology.",
    "0": "Founder unable to clearly explain how a startup is not just technology but about running, operating and growing a business.",
};

// Desirability — out of 5 marks
const DESIRABILITY_MAP: Record<string, string> = {
    "5":   "Problem and target user defined very clearly with specifics provided and clear evidence of demand mentioned.",
    "4":   "Problem and target user defined very clearly with specifics provided but no clear evidence of demand mentioned.",
    "2.5": "Problem and target user defined however minor gaps in specificity and no clear evidence of demand mentioned.",
    "1":   "Problem mentioned but too broad. Target market not clearly defined and evidence of demand not mentioned.",
    "0.5": "Weak problem articulation. No clear user definition. No evidence of demand.",
    "0":   "No clear problem. No market exists or will want this solution. Solution looking for a problem.",
};

// Viability — out of 5 marks
const VIABILITY_MAP: Record<string, string> = {
    "5":   "Solid well-defined revenue model and profitability and scalability seems quite possible.",
    "4":   "Solid well-defined revenue model but profitability and scalability is unclear.",
    "2":   "Revenue model exists but vague. Path to profitability and scalability is unclear.",
    "0.5": "Revenue model mentioned but not defined properly. Economics don't seem to work. Profitability seems difficult. Scalability doesn't seem possible.",
    "0":   "No revenue model defined. No monetisation thinking. Economics fundamentally don't work. Scalability not considered.",
};

// Feasibility — out of 5 marks
const FEASIBILITY_MAP: Record<string, string> = {
    "5":   "Technical capability clearly explained. Realistic build plan provided.",
    "4":   "Technical capability evident. Build plan mostly realistic. Minor complexity underestimated.",
    "2.5": "Technical capability evident but build plan doesn't exist.",
    "1":   "Possible to build but unclear technical capacity and underestimating complexity.",
    "0.5": "Significant technical gaps. Unclear how they'd actually build this. Unrealistic thinking.",
    "0":   "No technical capability. Major legal barriers ignored. Delusional or unrealistic thinking.",
};

// Defensibility — out of 5 marks
const DEFENSIBILITY_MAP: Record<string, string> = {
    "5":   "At least 1 strong moat clearly defined and proven: very strong network, proprietary tech/IP, unique data, breakthrough technology, or very unique insight.",
    "3.5": "One credible moat identified and clearly articulated but only exists on paper, not yet fully built or proven.",
    "2":   "Some differentiation exists but doesn't create a strong competitive advantage. E.g. first-mover advantage only.",
    "0.5": "Very weak differentiation. Very easy to replicate. No credible moat identified.",
    "0":   "No differentiator. Completely replicable. No moat thinking. Anyone can build it very easily.",
};

// Affordability — out of 5 marks
const AFFORDABILITY_MAP: Record<string, string> = {
    "5":   "Pricing clearly fits the Indian target segment. Founder has defined exact pricing with proper research about pricing in India in that segment.",
    "3.5": "India context considered meaningfully but pricing is not yet fully defined.",
    "2":   "Pricing and affordability not considered proactively. Has shown some thought of India-first pricing when asked but had not considered it until now.",
    "0.5": "Pricing not thought through for India. Weak India context. Doesn't show much regard for Indian context in pricing.",
    "0":   "Delusional pricing that does not fit the Indian market. No thought given to affordability.",
};

// AI Mission Fit — out of 3 marks (cumulative criteria)
const MISSION_FIT_MAP: Record<string, string> = {
    "3":   "AI is indispensable to the product, credible pillar connection, clear ecosystem contribution, and founder is aware of IndiaAI Mission.",
    "2.5": "AI is indispensable to the product, credible pillar connection, clear ecosystem contribution, but founder is unaware of IndiaAI Mission.",
    "2":   "AI is indispensable to the product, credible pillar connection, but ecosystem contribution is unclear and founder is unaware of IndiaAI Mission.",
    "1":   "AI is indispensable to the product but no credible pillar connection, ecosystem contribution is unclear and founder is unaware of IndiaAI Mission.",
    "0":   "No credible AI mission pillar connection. AI is decorative or an add-on feature. Product can be built without AI. Founder is unaware of IndiaAI Mission.",
};

// ─── LLM-Friendly Schema (short codes instead of long enum strings) ──

const LLMReportSchema = z.object({
    founder_name: z.string(),
    company_name: z.string().default("Not specified"),
    company_name_evidence: z.array(z.string()),
    professional_background: z.string(),
    professional_background_evidence: z.array(z.string()),
    education_background: z.string(),
    education_background_evidence: z.array(z.string()),
    hobbies: z.string().default("Not specified"),
    hobbies_evidence: z.array(z.string()),
    why_entrepreneurship: z.string().default("Not specified"),
    why_entrepreneurship_evidence: z.array(z.string()),
    financial_commitments: z.string().default("Not specified"),
    financial_commitments_evidence: z.array(z.string()),
    goals_short_term: z.string().default("Not specified").describe("Founder's short-term goals"),
    goals_short_term_evidence: z.array(z.string()),
    goals_mid_term: z.string().default("Not specified").describe("Founder's mid-term goals"),
    goals_mid_term_evidence: z.array(z.string()),
    goals_long_term: z.string().default("Not specified").describe("Founder's long-term goals"),
    goals_long_term_evidence: z.array(z.string()),
    grit_evaluation: z.enum(["2", "1.5", "0.5", "0", "not_discussed"]),
    grit_evaluation_evidence: z.array(z.string()),
    grit_evaluation_reasoning: z.string(),
    business_thinking_evaluation: z.enum(["1", "0"]),
    business_thinking: z.string().default("Not specified"),
    business_thinking_evidence: z.array(z.string()),
    founder_structure: z.enum(["Solo founder", "Co-founder team"]).default("Solo founder"),
    founder_structure_evidence: z.array(z.string()),
    role_division: z.string().default("Not specified"),
    role_division_evidence: z.array(z.string()),
    team_division_evaluation: z.enum(["1", "0.5", "0"]),
    financial_commitments_evaluation: z.enum(["1", "0"]),
    idea: z.string(),
    idea_evidence: z.array(z.string()),
    macro_context: z.string().default("Not specified"),
    macro_context_evidence: z.array(z.string()),
    development_stage: z.enum(["Idea", "Concept", "Prototype", "Early MVP", "MVP", "Growth", "Not specified"]).default("Not specified"),
    development_stage_evidence: z.array(z.string()),
    desirability_evaluation: z.enum(["5", "4", "2.5", "1", "0.5", "0"]),
    desirability_evidence: z.array(z.string()),
    desirability_note: z.string(),
    viability_evaluation: z.enum(["5", "4", "2", "0.5", "0"]),
    viability_evidence: z.array(z.string()),
    viability_note: z.string(),
    feasibility_evaluation: z.enum(["5", "4", "2.5", "1", "0.5", "0"]),
    feasibility_evidence: z.array(z.string()),
    feasibility_note: z.string(),
    defensibility_evaluation: z.enum(["5", "3.5", "2", "0.5", "0"]),
    defensibility_evidence: z.array(z.string()),
    defensibility_note: z.string(),
    affordability_evaluation: z.enum(["5", "3.5", "2", "0.5", "0"]),
    affordability_evidence: z.array(z.string()),
    affordability_note: z.string(),
    mission_fit_evaluation: z.enum(["3", "2.5", "2", "1", "0"]),
    mission_fit_evidence: z.array(z.string()),
    indiaai_pillar: z.enum([
        "1 — IndiaAI Innovation Centre",
        "2 — IndiaAI Application Development",
        "3 — AIKosh",
        "4 — IndiaAI Compute Capacity",
        "5 — IndiaAI Startup Financing",
        "6 — IndiaAI FutureSkills",
        "7 — Safe & Trusted AI",
        "None",
    ]),
    mission_fit_reasoning: z.string(),
    mission_fit_reasoning_evidence: z.array(z.string()),
    overall_summary: z.string().describe("2-3 paragraph analytical assessment of the founder and startup, covering strengths, risks, and a balanced conclusion. Write like a senior investor analyst."),
});

type LLMReport = z.infer<typeof LLMReportSchema>;

// ─── Compact Field Manifest (replaces verbose JSON Schema) ──────────

const ANALYST_FIELD_MANIFEST = `
IMPORTANT: Output a FLAT JSON object. Do NOT nest fields inside categories or sub-objects.
All fields are top-level keys. All fields are REQUIRED.

FILL IN THIS ORDER: For each group below, fill the _evidence array FIRST by copying verbatim sentences from the transcript, THEN fill the text/score field based only on what you put in evidence.

founder_name (string) — Full name of the founder
company_name_evidence (string[]) — Copy exact sentences from transcript about the company name or "not mentioned"
company_name (string) — Extract the company name from evidence above, or use "Not specified"
professional_background_evidence (string[]) — Copy exact sentences from transcript about work/career
professional_background (string) — Summarize from evidence above
education_background_evidence (string[]) — Copy exact sentences from transcript about education
education_background (string) — Summarize from evidence above
hobbies_evidence (string[]) — Copy exact sentences from transcript about hobbies
hobbies (string) — Summarize from evidence above
why_entrepreneurship_evidence (string[]) — Copy exact sentences from transcript about motivation
why_entrepreneurship (string) — Summarize from evidence above
financial_commitments_evidence (string[]) — Copy exact sentences from transcript about financial obligations
financial_commitments (string) — Summarize from evidence above
goals_short_term_evidence (string[]) — Copy exact sentences from transcript about short-term goals
goals_short_term (string) — Summarize from evidence above
goals_mid_term_evidence (string[]) — Copy exact sentences from transcript about mid-term goals
goals_mid_term (string) — Summarize from evidence above
goals_long_term_evidence (string[]) — Copy exact sentences from transcript about long-term goals
goals_long_term (string) — Summarize from evidence above
grit_evaluation_evidence (string[]) — Copy exact sentences from transcript about failure/resilience
grit_evaluation_reasoning (string) — Brief explanation for score based on evidence above
grit_evaluation ("2"|"1.5"|"0.5"|"0"|"not_discussed") — Score: "2"=specific failure+concrete recovery+clear lesson, "1.5"=specific failure+mostly concrete recovery, "0.5"=failure mentioned but vague recovery/lesson, "0"=no story or very vague, "not_discussed"=not covered
business_thinking_evidence (string[]) — Copy exact sentences from transcript about startup-as-business
business_thinking (string) — Summarize from evidence above
business_thinking_evaluation ("1"|"0") — "1"=founder clearly explains startup is about running/operating/growing a business beyond tech, "0"=founder unable to explain this
founder_structure_evidence (string[]) — Copy exact sentences about solo/co-founder
founder_structure ("Solo founder"|"Co-founder team") — Classify from evidence above
role_division_evidence (string[]) — Copy exact sentences about how roles are managed
role_division (string) — Summarize from evidence above
team_division_evaluation ("1"|"0.5"|"0") — Count TOTAL founders (including the main founder): "1"=2 or 3 total founders, "0.5"=4 or more total founders, "0"=solo founder (1 person only)
financial_commitments_evaluation ("1"|"0") — "1"=founder has no financial commitments or obligations, "0"=financial commitments or obligations exist
idea_evidence (string[]) — Copy exact sentences from transcript about the startup idea and problem
idea (string) — Summarize from evidence above
macro_context_evidence (string[]) — Copy 1-3 sentences from the transcript that reveal the industry, problem space, target customer segment, or market the founder is entering. Look in the startup idea, desirability, feasibility, and ecosystem answers — there is NO dedicated macro context question. Use the idea description and problem statement sentences.
macro_context (string) — From those sentences, write 1-2 sentences describing: (1) what industry/space this startup is in, (2) the core problem or opportunity in that space as described by the founder. Do NOT copy sentences verbatim — synthesize a clean industry + problem context statement. NEVER write "Not specified".
development_stage_evidence (string[]) — Copy exact sentences mentioning a built product/prototype/users (or [] if none)
development_stage ("Idea"|"Concept"|"Prototype"|"Early MVP"|"MVP"|"Growth"|"Not specified") — If evidence is empty, use "Idea"
desirability_evidence (string[]) — Copy exact sentences from transcript about the problem, market, customer demand
desirability_evaluation ("5"|"4"|"2.5"|"1"|"0.5"|"0") — "5"=problem+user very clearly defined+specifics+clear demand evidence, "4"=very clearly defined+specifics but NO demand evidence, "2.5"=defined but minor gaps in specificity+no demand, "1"=too broad+market unclear+no demand, "0.5"=weak articulation+no user+no demand, "0"=no clear problem+solution looking for problem
desirability_note (string) — Brief explanation for score based on evidence above
viability_evidence (string[]) — Copy exact sentences from transcript about revenue, pricing, business model
viability_evaluation ("5"|"4"|"2"|"0.5"|"0") — "5"=solid revenue model+profitability+scalability all possible, "4"=solid revenue model but profitability/scalability unclear, "2"=revenue model vague+path unclear, "0.5"=model not defined+economics don't work, "0"=no revenue model at all
viability_note (string) — Brief explanation based on evidence above
feasibility_evidence (string[]) — Copy exact sentences from transcript about technical capability
feasibility_evaluation ("5"|"4"|"2.5"|"1"|"0.5"|"0") — "5"=tech capability clearly explained+realistic build plan, "4"=tech evident+build plan mostly realistic, "2.5"=tech evident but no build plan, "1"=possible to build but unclear capacity+underestimates complexity, "0.5"=significant gaps+unrealistic, "0"=no capability+delusional
feasibility_note (string) — Brief explanation based on evidence above
defensibility_evidence (string[]) — Copy exact sentences from transcript about moats, differentiation
defensibility_evaluation ("5"|"3.5"|"2"|"0.5"|"0") — "5"=strong proven moat (network/IP/unique data/breakthrough tech), "3.5"=credible moat articulated but only on paper/unproven, "2"=some differentiation but easily copied (e.g. first-mover only), "0.5"=very weak+easy to replicate, "0"=no differentiator at all
defensibility_note (string) — Brief explanation based on evidence above
affordability_evidence (string[]) — Copy exact sentences from transcript about pricing, India affordability
affordability_evaluation ("5"|"3.5"|"2"|"0.5"|"0") — "5"=exact India pricing defined+proper research done, "3.5"=India context considered meaningfully but pricing not yet defined, "2"=not proactively considered+showed some thought only when asked, "0.5"=not thought through for India+weak context, "0"=delusional pricing+no India consideration
affordability_note (string) — Brief explanation based on evidence above
mission_fit_evidence (string[]) — Copy exact sentences from transcript about IndiaAI, AI necessity, ecosystem contribution
mission_fit_evaluation ("3"|"2.5"|"2"|"1"|"0") — Cumulative criteria: "3"=AI indispensable+credible pillar+clear ecosystem contribution+founder AWARE of IndiaAI Mission, "2.5"=AI indispensable+credible pillar+clear ecosystem contribution+founder UNAWARE, "2"=AI indispensable+credible pillar+ecosystem UNCLEAR+founder UNAWARE, "1"=AI indispensable+NO pillar+ecosystem UNCLEAR+founder UNAWARE, "0"=AI NOT indispensable or decorative
indiaai_pillar (string) — MUST be exactly one of: "1 — IndiaAI Innovation Centre", "2 — IndiaAI Application Development", "3 — AIKosh", "4 — IndiaAI Compute Capacity", "5 — IndiaAI Startup Financing", "6 — IndiaAI FutureSkills", "7 — Safe & Trusted AI", "None"
mission_fit_reasoning_evidence (string[]) — Copy exact sentences supporting pillar choice
mission_fit_reasoning (string) — Explain pillar choice based on evidence above
overall_summary (string) — 2-3 paragraph analytical assessment. Use they/them pronouns. Use \\n for newlines.
`.trim();

// ─── Map LLM Short Codes → Full Enum Descriptions ──────────────────

function mapLLMResponseToReport(llm: LLMReport): UnifiedReport {
    return {
        ...llm,
        grit_evaluation: GRIT_MAP[llm.grit_evaluation] as UnifiedReport["grit_evaluation"],
        business_thinking_evaluation: BUSINESS_THINKING_MAP[llm.business_thinking_evaluation] as UnifiedReport["business_thinking_evaluation"],
        team_division_evaluation: TEAM_DIVISION_MAP[llm.team_division_evaluation] as UnifiedReport["team_division_evaluation"],
        financial_commitments_evaluation: FINANCIAL_EVAL_MAP[llm.financial_commitments_evaluation] as UnifiedReport["financial_commitments_evaluation"],
        desirability_evaluation: DESIRABILITY_MAP[llm.desirability_evaluation] as UnifiedReport["desirability_evaluation"],
        viability_evaluation: VIABILITY_MAP[llm.viability_evaluation] as UnifiedReport["viability_evaluation"],
        feasibility_evaluation: FEASIBILITY_MAP[llm.feasibility_evaluation] as UnifiedReport["feasibility_evaluation"],
        defensibility_evaluation: DEFENSIBILITY_MAP[llm.defensibility_evaluation] as UnifiedReport["defensibility_evaluation"],
        affordability_evaluation: AFFORDABILITY_MAP[llm.affordability_evaluation] as UnifiedReport["affordability_evaluation"],
        mission_fit_evaluation: MISSION_FIT_MAP[llm.mission_fit_evaluation] as UnifiedReport["mission_fit_evaluation"],
    };
}

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

    // Strip stray unquoted words that appear after [ or , where a JSON value is expected.
    // e.g. `[ ait\n    "Short-term..."` → `[ "Short-term..."`
    // This catches LLM annotation leakage like "ait", "wait", "note:", etc.
    s = s.replace(/([,\[]\s*)(?!true\b|false\b|null\b|"|-?\d|\{|\[|\])([a-zA-Z_][a-zA-Z_0-9 :]*?)(\s*[\n\r]+\s*(?=["{[\]]))/g, '$1$3');

    // Replace literal control characters inside JSON string values (common LLM error)
    // State machine: track whether we're inside a quoted string
    let inString = false;
    let escaped = false;
    let result = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\' && inString) {
            result += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
        }
        if (inString && ch.charCodeAt(0) < 0x20) {
            // Control character inside a JSON string — escape it
            if (ch === '\n') result += '\\n';
            else if (ch === '\r') result += '\\r';
            else if (ch === '\t') result += '\\t';
            else result += ''; // strip other control chars
        } else {
            result += ch;
        }
    }

    return result;
}

// ─── Generic LLM JSON Call with Zod + Auto-Retry ────────────────────

async function callLLMForJSON<T>(
    schema: z.ZodType<T>,
    chunkName: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 8192,
    temperature: number = 0,
): Promise<T | null> {
    const MAX_RETRIES = 5;
    let lastZodError: string | null = null; // Track last Zod error for feedback
    // No JSON Schema sent to LLM — Zod handles validation on our end.
    // LLM sees only the compact ANALYST_FIELD_MANIFEST.

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            let effectivePrompt = `${userPrompt}\n\n=== OUTPUT FIELDS (your output MUST include every field below) ===\n${ANALYST_FIELD_MANIFEST}\n\nNow output the JSON. Start with {`;

            if (lastZodError && attempt > 0) {
                // Keep feedback concise — just list missing/invalid field names, not full enum values
                effectivePrompt += `\n\n⚠️ YOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix these fields:\n${lastZodError}\nRefer to the OUTPUT FIELDS list above for valid values. ALL fields are required. Output RAW JSON ONLY.`;
                console.log(`🔄 ${chunkName} retry ${attempt + 1} with error feedback`);
            }

            // Rough token estimate: ~4 chars per token for English text
            const systemTokens = Math.ceil(systemPrompt.length / 4);
            const promptTokens = Math.ceil(effectivePrompt.length / 4);
            const totalInputTokens = systemTokens + promptTokens;
            console.log(`📐 ${chunkName} token estimate (attempt ${attempt + 1}): system=${systemTokens}, prompt=${promptTokens}, total_input=~${totalInputTokens} tokens (${systemPrompt.length + effectivePrompt.length} chars)`);

            // DEBUG: Print full effective prompt on first attempt
            if (attempt === 0) {
                console.log(`\n${"=".repeat(80)}\n🔍 FULL SYSTEM PROMPT (${systemPrompt.length} chars):\n${"=".repeat(80)}\n${systemPrompt}\n${"=".repeat(80)}`);
                console.log(`\n${"=".repeat(80)}\n🔍 FULL EFFECTIVE PROMPT (${effectivePrompt.length} chars):\n${"=".repeat(80)}\n${effectivePrompt}\n${"=".repeat(80)}\n`);
            }

            const { text, usage } = await generateText({
                model: getAnalystModel(),
                system: systemPrompt,
                prompt: effectivePrompt,
                temperature: temperature,
                maxOutputTokens: maxTokens,
                maxRetries: 1, // Don't let AI SDK retry on server errors — we handle retries ourselves
            });

            if (usage) {
                console.log(`📊 ${chunkName} ACTUAL tokens (attempt ${attempt + 1}):`, JSON.stringify(usage));
            }
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
                // Store concise error — just field names and short reason, not full enum lists
                const conciseErrors = Object.entries(flatError.fieldErrors)
                    .map(([field, msgs]) => {
                        const msg = (msgs as string[])[0] || "invalid";
                        // Truncate long "expected one of ..." messages to just "invalid enum value"
                        if (msg.startsWith("Invalid option:")) return `${field}: invalid enum value (check schema)`;
                        if (msg.includes("expected array")) return `${field}: must be an array`;
                        if (msg.includes("expected string")) return `${field}: must be a string`;
                        return `${field}: ${msg.substring(0, 60)}`;
                    })
                    .join("\n");
                lastZodError = conciseErrors;
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
    checkArray(report.company_name_evidence, "company_name_evidence");
    checkArray(report.professional_background_evidence, "professional_background_evidence");
    checkArray(report.education_background_evidence, "education_background_evidence");
    checkArray(report.hobbies_evidence, "hobbies_evidence");
    checkArray(report.why_entrepreneurship_evidence, "why_entrepreneurship_evidence");
    checkArray(report.financial_commitments_evidence, "financial_commitments_evidence");
    checkArray(report.goals_short_term_evidence, "goals_short_term_evidence");
    checkArray(report.goals_mid_term_evidence, "goals_mid_term_evidence");
    checkArray(report.goals_long_term_evidence, "goals_long_term_evidence");
    checkArray(report.founder_structure_evidence, "founder_structure_evidence");
    checkArray(report.role_division_evidence, "role_division_evidence");
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
// Scores are parsed directly from the LLM's numeric string codes (e.g. "2.5", "4").
// This avoids all fragile substring matching on description strings.

function computeDeterministicScores(llm: LLMReport) {
    // ── Founder Profile sub-scores (/5 total) ──
    const teamDivisionScore    = parseFloat(llm.team_division_evaluation);          // "1" | "0.5" | "0"
    const financialScore       = parseFloat(llm.financial_commitments_evaluation);  // "1" | "0"
    const failureScore         = llm.grit_evaluation === "not_discussed" ? 0 : parseFloat(llm.grit_evaluation); // "2" | "1.5" | "0.5" | "0"
    const businessThinkingScore = parseFloat(llm.business_thinking_evaluation);     // "1" | "0"

    const founderProfileTotal  = teamDivisionScore + financialScore + failureScore + businessThinkingScore;

    // ── 5-Zone Business Scorecard (/25 total) ──
    const dScore   = parseFloat(llm.desirability_evaluation);   // "5" | "4" | "2.5" | "1" | "0.5" | "0"
    const vScore   = parseFloat(llm.viability_evaluation);      // "5" | "4" | "2"   | "0.5" | "0"
    const fScore   = parseFloat(llm.feasibility_evaluation);    // "5" | "4" | "2.5" | "1" | "0.5" | "0"
    const defScore = parseFloat(llm.defensibility_evaluation);  // "5" | "3.5" | "2" | "0.5" | "0"
    const aScore   = parseFloat(llm.affordability_evaluation);  // "5" | "3.5" | "2" | "0.5" | "0"

    const zoneTotal = dScore + vScore + fScore + defScore + aScore;

    // ── AI Mission Fit (/3 total) ──
    const missionFitScore = parseFloat(llm.mission_fit_evaluation); // "3" | "2.5" | "2" | "1" | "0"

    const total = founderProfileTotal + zoneTotal + missionFitScore;

    return {
        teamDivision: teamDivisionScore,
        financial: financialScore,
        failure: failureScore,
        businessThinking: businessThinkingScore,
        founderProfile: founderProfileTotal,
        desirability: dScore,
        viability: vScore,
        feasibility: fScore,
        defensibility: defScore,
        affordability: aScore,
        zoneTotal,
        missionFit: missionFitScore,
        total,
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

    const baseContext = [
        `=== INTERVIEW TRANSCRIPT ===`,
        transcript,
        `=== END OF TRANSCRIPT ===`,
        ``,
        `=== TASK ===`,
        `Read the interview transcript above and produce a structured evaluation report.`,
        `Follow all system instructions. Return ONLY valid JSON matching the schema at the end.`,
        `Every field that was discussed has an answer in the transcript — find it.`,
        ``,
        `=== FLAGS DETECTED BY SECONDARY AGENT ===`,
        `RED FLAGS:`,
        redFlagsStr,
        ``,
        `GREEN FLAGS:`,
        greenFlagsStr,
    ].join("\n");

    console.log("Generating unified report...");
    const llmData = await callLLMForJSON(
        LLMReportSchema,
        "Unified Report",
        ANALYST_PROMPT,
        baseContext,
        8192,
        0.1 // Temp 0.1 for high determinism
    );

    if (!llmData) {
        return "ERROR: Analyst flow failed to generate a valid report after maximum retries.";
    }

    const reportData = mapLLMResponseToReport(llmData);

    const warnings = validateReportAgainstTranscript(reportData, transcript);
    if (warnings.length > 0) {
        console.warn("\n⚠️ TRANSCRIPT VALIDATION WARNINGS (Missing Evidence):\n" + warnings.join("\n") + "\n");
    }

    const scores = computeDeterministicScores(llmData);

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
    const displayCompanyName = (report.company_name && report.company_name !== "Not specified") 
        ? report.company_name 
        : (companyName || "Not specified");
    lines.push(`**${report.founder_name} | ${displayCompanyName} | ${reportDate}**`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 1: Founder Profile
    lines.push("## SECTION 1 — FOUNDER PROFILE");
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Who They Are** | ${report.education_background} · ${report.professional_background} · Hobbies: ${report.hobbies} |`);
    lines.push(`| **Why Entrepreneurship** | ${report.why_entrepreneurship} |`);
    lines.push(`| **Financial Commitments [${scores.financial} / 1]** | ${report.financial_commitments} |`);
    lines.push(`| **Goals** | Short-term: ${report.goals_short_term} · Mid-term: ${report.goals_mid_term} · Long-term: ${report.goals_long_term} |`);
    lines.push(`| **Grit Score [${scores.failure} / 2]** | ${report.grit_evaluation_reasoning} |`);
    lines.push(`| **Business Thinking [${scores.businessThinking} / 1]** | ${report.business_thinking} |`);
    lines.push(`| **Founder Structure [${scores.teamDivision} / 1]** | ${report.founder_structure} — ${report.role_division !== "Not specified" ? report.role_division : "Role management details not discussed"} |`);
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
        pitchStr = `YES ([LINK](${pitchDeckUrl}))`;
    }
    let webStr = "NO";
    if (websiteUrl && websiteUrl !== "Not provided") {
        const fullWebUrl = websiteUrl.startsWith("http") ? websiteUrl : "https://" + websiteUrl;
        webStr = `YES ([LINK](${fullWebUrl}))`;
    }
    lines.push(`| **Assets** | Pitch deck: ${pitchStr} · Website: ${webStr} |`);
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
    lines.push(`| **TOTAL** | **${scores.zoneTotal} / 25** | |`);
    lines.push("");

    if (scores.desirability <= 1) {
        lines.push("> ⚠️ **DESIRABILITY GATE:** Desirability scored 0 or 0.5 — a product without a credible market cannot become a viable business regardless of other zone scores.");
        lines.push("");
    }
    lines.push("---");
    lines.push("");

    // Section 4: Flags
    lines.push("## SECTION 4 — FLAGS");
    lines.push("");
    lines.push("| 🔴 RED FLAGS | 🟢 GREEN FLAGS |");
    lines.push("|---|---|");

    // Format flags using SkepticSummary with markdown bullets
    const buildFlagItem = (f: { category: string, description: string, _evidence: string[] }) => {
        return `• **${f.category}**: ${f.description}`;
    };

    const rDisplay = skepticSummary.redFlags.length > 0
        ? skepticSummary.redFlags.map(buildFlagItem).join("<br>")
        : "None detected.";

    const gDisplay = skepticSummary.greenFlags.length > 0
        ? skepticSummary.greenFlags.map(buildFlagItem).join("<br>")
        : "None detected.";

    lines.push(`| ${rDisplay} | ${gDisplay} |`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Section 5: AI Mission Fit Score
    lines.push("## SECTION 5 — AI MISSION FIT SCORE");
    lines.push("");
    lines.push(`**AI Mission Fit Score: ${scores.missionFit} / 3**`);
    lines.push(``);
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
    lines.push(`| Grit Score | ${scores.failure} / 2 |`);
    lines.push(`| Financial Commitments | ${scores.financial} / 1 |`);
    lines.push(`| Business Thinking | ${scores.businessThinking} / 1 |`);
    lines.push(`| Founder Structure | ${scores.teamDivision} / 1 |`);
    lines.push(`| AI Mission Fit Score | ${scores.missionFit} / 3 |`);
    lines.push(`| **FINAL SCORE** | **${scores.total} / 33** |`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("**OVERALL SUMMARY**");
    lines.push("");
    if (scores.desirability <= 1) {
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
