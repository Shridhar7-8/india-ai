import { generateText } from "ai";
import { getModel } from "@/lib/bedrock";
import { ConductorEvalSchema } from "@/lib/schemas";

// ─── FSM Step Definitions ───────────────────────────────────────────

export interface Step {
    id: string;
    prompt: string;           // Hardcoded fallback question text
    maxDrills: number;        // Max follow-up attempts before auto-advance
    evalPrompt?: string;      // Optional: extra context for the LLM evaluator
}

/**
 * The STEPS array is the single source of truth for interview sequencing.
 * The backend walks through this array by integer index.
 * The LLM NEVER controls which step comes next.
 */
export const STEPS: Step[] = [
    // ── Phase 1: Founder ──
    { id: "name", prompt: "Could you please tell me your full name to get started?", maxDrills: 1, evalPrompt: "CRITICAL: This step is ONLY for the founder's full personal name. If the user only provided a first name, or hasn't provided their name at all, your follow-up MUST ask for their full name. NEVER ask for the company or project name in this step." },
    { id: "professional_background", prompt: "Tell me about your professional background and work experience.", maxDrills: 0 },
    { id: "education_background", prompt: "What is your educational background?", maxDrills: 0 },
    { id: "life_goals", prompt: "What are your short-term, mid-term, and long-term life goals?", maxDrills: 2, evalPrompt: "Accept ONLY if the answer EXPLICITLY addresses all 3 timeframes: short-term, mid-term, AND long-term — each with a separate directional goal. A single generic sentence with no timeframe breakdown (e.g. 'I want to grow', 'be successful', 'scale internationally') = answered=false. Do NOT require specific numbers, dates, or metrics — directional clarity per timeframe is sufficient. If any of the 3 timeframes is missing or unclear, answered=false." },
    { id: "startup_vs_technology", prompt: "What does it mean to you that a startup is a BUSINESS, not just a technology?", maxDrills: 2, evalPrompt: "The answer must show genuine understanding of BUSINESS fundamentals (e.g., revenue, customers, market, operations, sales) vs just building technology. Generic statements like 'business is important' or 'it's not just about tech' without explaining WHAT that means concretely = answered=false. Look for specific business thinking." },
    { id: "founder_status_step1", prompt: "Are you building this as a solo founder or do you have co-founders?", maxDrills: 0 },
    { id: "founder_status_step2", prompt: "", maxDrills: 0 },  // prompt set dynamically by backend
    { id: "financial_obligations", prompt: "What are your personal and family financial obligations?", maxDrills: 0, evalPrompt: "This is about PERSONAL and FAMILY obligations only, NOT startup funding." },
    { id: "failure_story", prompt: "Can you share a failure you experienced and what you learned from it?", maxDrills: 2, evalPrompt: "Accept ANY failure (childhood, academic, personal, professional). Never ask for a 'bigger' one. The answer must include: (1) a SPECIFIC description of what failed (not just 'a project failed'), and (2) a CONCRETE lesson learned (not just 'I learned to be better'). If either the failure or the lesson is vague/generic, answered=false." },
    { id: "hobbies", prompt: "What are your hobbies or interests outside of work?", maxDrills: 0 },
    { id: "the_why", prompt: "What motivates you to build this startup?", maxDrills: 0 },

    // ── Phase 2: Business ──
    { id: "startup_idea", prompt: "Tell me about your startup idea — what problem are you solving and what is your solution?", maxDrills: 2 },
    { id: "zone_1_desirability", prompt: "Who are your target customers and why would they want this?", maxDrills: 2 },
    { id: "zone_2_viability", prompt: "What is your business model and how will you generate revenue?", maxDrills: 2 },
    { id: "zone_3_feasibility", prompt: "Do you have the technical capability and team to build this?", maxDrills: 2, evalPrompt: "Accept if the founder confirms they can build the core product — either through their own skills or a clear existing team. Future hiring plans are a bonus, not required. Do NOT drill into future roles, hiring skills, or specific technology vendor/API names. If the founder mentions a category of tools (e.g. 'LLM APIs', 'cloud infrastructure'), that is sufficient. One follow-up is acceptable only if current technical capability is entirely unclear." },
    { id: "zone_4_defensibility", prompt: "What makes your solution hard to replicate?", maxDrills: 2, evalPrompt: "Accept if the founder identifies at least one credible moat mechanism (data advantage, network effects, proprietary workflow, switching costs, domain expertise, etc.). Do NOT drill into product UX or user experience examples — stay focused on competitive defensibility. One follow-up is acceptable if the moat is purely generic ('we work hard')." },
    { id: "zone_5_affordability", prompt: "How does your pricing fit within the Indian market?", maxDrills: 2, evalPrompt: "Focus ONLY on India-specific affordability: does the pricing make sense relative to the Indian market (student budgets, regional income levels, comparison to similar Indian products)? If the founder gives India-relevant pricing rationale, answered=true. Do NOT re-ask about tier structure or feature breakdown — that was covered in viability. One follow-up is acceptable only if there is zero India-specific context." },

    // ── Phase 3: AI & IndiaAI ──
    { id: "ai_interest", prompt: "What got you interested in AI? Was there a specific moment or problem that drew you to it?", maxDrills: 1, evalPrompt: "Accept any genuine personal story or motivation. Do NOT demand technical details or metrics. If they mention a moment, problem, or general interest in AI, answered=true." },
    { id: "ai_necessity", prompt: "Why does your product specifically require AI? Would it not be possible to build this without AI?", maxDrills: 2, evalPrompt: "The answer should explain WHY the product structurally needs AI (what breaks without it). Accept clear reasoning about what AI enables that rule-based or traditional approaches cannot. One follow-up asking for a concrete example is acceptable. Do NOT ask follow-up questions about user outcomes, product benefits, or business results — those are not AI necessity. Stay strictly focused on structural necessity only." },
    { id: "ai_ecosystem_contribution", prompt: "How do you think your product will contribute to the Indian AI ecosystem?", maxDrills: 2, evalPrompt: "The answer should describe ecosystem-level contribution: AI adoption, Indian-language tools, local datasets, talent, or public services. Accept vision-level answers with at least one concrete mechanism. Do NOT ask follow-up questions about scaling strategy, go-to-market, distribution, or user growth — those are business questions, not ecosystem questions. Stay strictly scoped to ecosystem impact." },
    { id: "indiaai_awareness", prompt: "Are you aware of the IndiaAI Mission?", maxDrills: 0, evalPrompt: "This is a simple yes/no awareness check. Any answer indicating awareness or lack thereof is sufficient." },
    { id: "indiaai_alignment", prompt: "How does your product empower the IndiaAI Mission?", maxDrills: 2, evalPrompt: "The answer should explain how the product aligns with or empowers the IndiaAI Mission. Accept answers that describe contribution to AI adoption, local capability building, or government AI goals. If they provide a clear example, answered=true." },

    // ── Phase 4: Closing ──
    { id: "company_name", prompt: "What is the name of your company or startup?", maxDrills: 0 },
    { id: "company_incorporated", prompt: "Is your company legally incorporated? If yes, could you share when it was incorporated?", maxDrills: 0 },
    { id: "pitch_deck", prompt: "Do you have a pitch deck? If yes, please upload it.", maxDrills: 0 },
    { id: "website", prompt: "Do you have a website? If yes, please share the URL.", maxDrills: 0 },
];

// ─── Solo/Co-founder Detection ──────────────────────────────────────
/**
 * Determine whether the founder is solo based on their answer.
 *
 * Priority rules:
 * 1. Explicit solo keywords always win ("solo founder", "by myself", etc.)
 * 2. Only flag as co-founder if the message contains CURRENT co-founder language
 *    that is NOT framed as a future plan ("open to", "plan to", "as we scale", etc.)
 * 3. Default to solo if ambiguous — step2 will surface the right question.
 */
function detectIsSolo(userMessage: string): boolean {
    const hasSoloSignal = /\b(solo\s*founder|solo|by\s*myself|just\s*me|alone|single\s*founder|only\s*one|i\s*am\s*the\s*only|building\s*(this\s*)?(myself|alone|by\s*myself))\b/i.test(userMessage);
    if (hasSoloSignal) return true;

    // Future-plan phrases that should NOT count as current co-founder status
    const isFuturePlan = /\b(open\s*to|plan\s*to|looking\s*for|will\s*bring|hope\s*to|intend\s*to|want\s*to|thinking\s*of|considering|eventually|as\s*we\s*scale|in\s*the\s*future|down\s*the\s*road|when\s*we\s*(grow|scale|expand)|will\s*add)\b/i.test(userMessage);

    const hasCurrentCoFounder = !isFuturePlan &&
        /\b(have\s*a\s*co-?founder|my\s*co-?founder|with\s*a?\s*co-?founder|co-?founders?\s*and\s*i|my\s*partner|building\s*together|we\s*(are|have|built|launched)\b)/i.test(userMessage);

    return !hasCurrentCoFounder;
}

// ─── LLM Prompt (simplified: evaluate + generate wording only) ──────

const FSM_EVAL_PROMPT = `You are FounderCheck, a warm and curious interviewer for ITEL Foundation.
Your TWO jobs: (1) evaluate whether the user's answer adequately covers the topic, and (2) generate natural conversational text.

OUTPUT FORMAT — RAW JSON ONLY, no markdown, no backticks:
{
  "answered": true/false,
  "is_off_topic": true/false,
  "response": "Your text (see rules below for what to write)"
}

RULES FOR "is_off_topic":
- Set is_off_topic=true ONLY IF the user's response is complete gibberish (e.g., "asdfgh"), completely unrelated to the interview (e.g., asking about the weather), or explicitly refusing to engage with the interview process in a disruptive way.
- CRITICAL: If the user is making ANY genuine attempt to answer the question, even if it is short, poorly formatted, or lacks detail, MUST set is_off_topic=false.
- If the user explicitly refuses to answer a specific question gracefully (e.g., "I'd rather not say"), set is_off_topic=false.

RULES FOR "answered":
1. answered=true ONLY if the answer contains CONCRETE, SPECIFIC information (names, numbers, examples, clear explanations).
2. answered=false if the answer is vague, generic, uses buzzwords without evidence, or is missing key parts.
3. If the user explicitly refuses to answer gracefully (e.g., "I'd rather not say"), set answered=true.


BE A STRICT SKEPTIC WHEN EVALUATING:
- "We have great traction" without metrics → answered=false
- "Our product is innovative/disruptive" without explaining HOW → answered=false
- "We plan to monetize through multiple channels" without naming them → answered=false
- Buzzwords + no specifics = answered=false. Buzzwords + concrete data = answered=true.
- When in doubt, set answered=false. It's better to ask one follow-up than to accept a shallow answer.

RULES FOR "response":
- If is_off_topic=true: Write a short, polite redirection. Example: "I appreciate you sharing that, but let's refocus on the interview for now." Do NOT repeat the question; the system will do that.
- If answered=true: Set "response" to exactly "". The system handles the next question automatically. Do NOT say "Got it, thanks", do NOT acknowledge the user at all.
  CRITICAL: Under NO circumstances should you ask a question when answered=true. Do NOT end with a question mark. Do NOT mention the next topic.
- If answered=false and is_off_topic=false: Write a conversational follow-up to get more detail about the CURRENT TOPIC ONLY.
  CRUCIAL TONE RULE: You MUST match the tone of the user's answer.
  - If the user says "I don't know", "I am not sure", or gives a short negative answer, DO NOT use positive affirmations like "That sounds great!" or "Promising!". Instead, be gently encouraging (e.g., "No worries! Even a rough estimate is fine—how are you currently thinking about [topic]?").
  - If the user gives a positive but vague answer, ONLY THEN can you be encouraging (e.g., "That sounds interesting, could you share a specific example?").
  Ask EXACTLY ONE follow-up question. Be warm, not interrogating.

TONE:
- Sound like a friendly, curious human — not a questionnaire bot.
- Use natural connectors and reactions.
- Never repeat a question word-for-word.
- Keep responses to 1-2 sentences maximum.

Do NOT decide what topic comes next — that is handled by the system.`;

// ─── Core FSM Engine ────────────────────────────────────────────────

export interface FSMInput {
    userMessage: string;
    stepIndex: number;
    drillCount: number;    // How many times we've asked about the current step
    conversationHistory: Array<{ role: string; content: string }>;
    /** Stored from the previous step1 answer for founder_status branching */
    founderIsSolo?: boolean;
}

export interface FSMResult {
    response: string;            // Text to show the user
    nextStepIndex: number;       // The new step_index to save to DB
    nextDrillCount: number;      // The new drill count for the next step
    checklistUpdate?: { key: string; value: boolean };  // For backward compat with checklist
    isComplete: boolean;         // True if the interview is done
    founderIsSolo?: boolean;     // Stored for step2 branching
    notedVague?: string;         // Track vague topics
}

export async function runConductorFSM(input: FSMInput): Promise<FSMResult> {
    const { userMessage, stepIndex, drillCount, conversationHistory } = input;
    console.log(`[CONDUCTOR] Input: stepIndex=${stepIndex}, drillCount=${drillCount}`);

    // ── Guard: interview already complete ──
    if (stepIndex >= STEPS.length) {
        return {
            response: "Thank you! Your interview is complete. We will now generate your evaluation report.",
            nextStepIndex: stepIndex,
            nextDrillCount: 0,
            isComplete: true,
        };
    }

    const currentStep = STEPS[stepIndex];

    // ── SPECIAL: founder_status_step2 — hard-coded branching ──
    if (currentStep.id === "founder_status_step2" && drillCount === 0) {
        // This is the first time we hit step2. We need to determine SOLO vs CO-FOUNDER
        // from the user's PREVIOUS answer (to step1).
        const isSolo = input.founderIsSolo ?? detectIsSolo(userMessage);
        const step2Question = isSolo
            ? "How do you plan to manage Product, Sales, and Tech all by yourself?"
            : "How do you split Product, Sales, and Tech among your team?";

        return {
            response: step2Question,
            nextStepIndex: stepIndex,       // Stay on step2 — wait for their answer
            nextDrillCount: drillCount + 1,
            founderIsSolo: isSolo,
            isComplete: false,
        };
    }

    // ── Build LLM eval prompt ──
    const recentHistory = conversationHistory.slice(-8)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const evalContext = `
CURRENT TOPIC: ${currentStep.id}
TOPIC QUESTION: ${currentStep.prompt}
${currentStep.evalPrompt ? `EVALUATION CRITERIA: ${currentStep.evalPrompt}` : ""}
DRILL COUNT: ${drillCount} (max ${currentStep.maxDrills})
${drillCount >= currentStep.maxDrills ? "⚠️ MAX DRILLS REACHED: Set answered=true regardless. Accept whatever they said and move on." : ""}

RECENT CONVERSATION:
${recentHistory}

USER'S LATEST MESSAGE: ${userMessage}

Remember: output RAW JSON only. No markdown.`.trim();

    // ── Call LLM with Zod validation + auto-retry ──
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { text } = await generateText({
                model: getModel(),
                messages: [
                    { role: "system", content: FSM_EVAL_PROMPT },
                    { role: "user", content: evalContext },
                ],
                temperature: 0.5,
                maxOutputTokens: 1024,
            });

            console.log(`🤖 FSM eval (attempt ${attempt + 1}, ${text.length} chars)`);

            if (!text || text.trim().length === 0) {
                console.warn(`⚠️ Empty LLM response (attempt ${attempt + 1})`);
                continue;
            }

            // Extract JSON Robustly
            let jsonStr = text.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonStr = jsonMatch[1].trim();

            const firstBrace = jsonStr.indexOf("{");
            const lastBrace = jsonStr.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch {
                console.warn(`⚠️ JSON parse error (attempt ${attempt + 1})`);
                continue;
            }

            // ── Zod Validation ──
            const zodResult = ConductorEvalSchema.safeParse(parsed);
            if (!zodResult.success) {
                console.warn(`⚠️ Zod validation failed (attempt ${attempt + 1})`);
                continue;
            }

            console.log(`[CONDUCTOR] LLM Result:`, zodResult.data);
            const { answered, response, is_off_topic } = zodResult.data;

            // ── Force advance if max drills reached ──
            let effectiveAnswered = (answered && !is_off_topic) || drillCount >= currentStep.maxDrills;

            // SPECIAL: Be extra strict with the 'name' step on the first message
            if (currentStep.id === "name" && drillCount === 0 && effectiveAnswered) {
                const isGreetingOnly = /^(hi|hello|hey|greetings|good\s+\w+)[\s,!.]*$/i.test(userMessage.trim());
                const isTooShort = userMessage.trim().split(/\s+/).length < 2 && !/^[A-Z][a-z]+$/.test(userMessage.trim());
                if (isGreetingOnly || isTooShort) {
                    console.log("🛡️ FSM: 'name' step strictness triggered — forcing answered=false");
                    effectiveAnswered = false;
                }
            }

            if (effectiveAnswered) {
                // ── ADVANCE to next step ──
                const advanceTo = stepIndex + 1;
                console.log(`[CONDUCTOR] Advancing from ${stepIndex} to ${advanceTo}`);

                let finalResponse = "";

                // SPECIAL: founder_status_step1 → override with hard-coded step2 question
                if (currentStep.id === "founder_status_step1") {
                    const isSolo = detectIsSolo(userMessage);
                    finalResponse = isSolo
                        ? "How do you plan to manage Product, Sales, and Tech all by yourself?"
                        : "How do you split Product, Sales, and Tech among your team?";

                    return {
                        response: finalResponse,
                        nextStepIndex: advanceTo,       // advance to step2
                        nextDrillCount: 1,              // so step2 evaluates the answer next call
                        checklistUpdate: undefined,
                        isComplete: false,
                        founderIsSolo: isSolo,
                    };
                }

                // Map step IDs to checklist keys for backward compatibility
                const checklistKey = currentStep.id.replace(/_step[12]$/, "");

                // HYBRID: Ask hardcoded next question
                if (advanceTo >= STEPS.length) {
                    finalResponse = "Thank you for completing the interview! We will now generate your evaluation report.";
                } else {
                    const hardcodedQuestion = STEPS[advanceTo].prompt;
                    // When force-advanced (max drills hit), the LLM response is a drill-down
                    // question — discard it to avoid showing two questions at once.
                    const forcedAdvance = drillCount >= currentStep.maxDrills;
                    finalResponse = (!forcedAdvance && response)
                        ? `${response}\n\n${hardcodedQuestion}`
                        : hardcodedQuestion;
                }

                return {
                    response: finalResponse || "Moving on...",
                    nextStepIndex: advanceTo,
                    nextDrillCount: 0,
                    checklistUpdate: { key: checklistKey, value: true },
                    isComplete: advanceTo >= STEPS.length,
                    founderIsSolo: input.founderIsSolo,
                };
            } else {
                // ── DRILL DOWN / STAY ON CURRENT STEP ──
                let finalResponse: string = response || "Could you please elaborate on that?";
                if (is_off_topic) {
                    const ack = response ? response.trim() : "Let's try to stay focused on the interview.";
                    finalResponse = `${ack}\n\n${currentStep.prompt}`;
                }

                console.log(`[CONDUCTOR] Staying on step ${stepIndex}, drillCount ${drillCount + 1}`);
                return {
                    response: finalResponse,
                    nextStepIndex: stepIndex,
                    nextDrillCount: drillCount + 1,
                    isComplete: false,
                    founderIsSolo: input.founderIsSolo,
                };
            }

        } catch (error) {
            console.error(`❌ FSM eval error (attempt ${attempt + 1}):`, error);
        }
    }

    // ── All retries failed: use hardcoded fallback ──
    if (drillCount >= currentStep.maxDrills || drillCount >= 1) {
        const checklistKey = currentStep.id.replace(/_step[12]$/, "");
        const nextPrompt = STEPS[stepIndex + 1]?.prompt || "Thank you! Your interview is complete.";
        return {
            response: nextPrompt,
            nextStepIndex: stepIndex + 1,
            nextDrillCount: 0,
            checklistUpdate: { key: checklistKey, value: true },
            isComplete: (stepIndex + 1) >= STEPS.length,
            founderIsSolo: input.founderIsSolo,
        };
    }

    return {
        response: currentStep.prompt || "Could you please tell me more about that?",
        nextStepIndex: stepIndex,
        nextDrillCount: drillCount + 1,
        isComplete: false,
        founderIsSolo: input.founderIsSolo,
    };
}

export function getInitialChecklist(): Record<string, boolean> {
    return {
        name: false,
        professional_background: false,
        education_background: false,
        life_goals: false,
        startup_vs_technology: false,
        founder_status: false,
        financial_obligations: false,
        failure_story: false,
        hobbies: false,
        the_why: false,
        startup_idea: false,
        zone_1_desirability: false,
        zone_2_viability: false,
        zone_3_feasibility: false,
        zone_4_defensibility: false,
        zone_5_affordability: false,
        ai_interest: false,
        ai_necessity: false,
        ai_ecosystem_contribution: false,
        indiaai_awareness: false,
        indiaai_alignment: false,
        company_name: false,
        company_incorporated: false,
        pitch_deck_and_website: false,
    };
}

export function getInitialSummary(): Record<string, unknown> {
    return {
        founder_name: null,
        startup_idea: null,
        startup_description: null,
        company_name: null,
        company_incorporated: null,
        key_features: [],
        background_summary: null,
        challenges_mentioned: [],
        tech_stack: [],
        refusals: [],
        clear_negatives: [],
        ai_interest_summary: null,
        indiaai_aware: null,
        indiaai_alignment_summary: null,
    };
}
