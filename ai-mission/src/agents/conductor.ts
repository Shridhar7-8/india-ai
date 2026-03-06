import { generateText } from "ai";
import { getModel } from "@/lib/ollama";
import { ConductorEvalSchema } from "@/lib/schemas";
import type { ConductorResponse } from "@/lib/schemas";

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
    { id: "name", prompt: "Could you please tell me your name to get started?", maxDrills: 3 },
    { id: "professional_background", prompt: "Tell me about your professional background and work experience.", maxDrills: 2 },
    { id: "education_background", prompt: "What is your educational background?", maxDrills: 2 },
    { id: "life_goals", prompt: "What are your short-term, mid-term, and long-term life goals?", maxDrills: 2, evalPrompt: "The answer must cover short-term AND mid-term AND long-term goals. If any are missing, answered=false." },
    { id: "startup_vs_technology", prompt: "What does it mean to you that a startup is a BUSINESS, not just a technology?", maxDrills: 2 },
    { id: "founder_status_step1", prompt: "Are you building this as a solo founder or do you have co-founders?", maxDrills: 2 },
    { id: "founder_status_step2", prompt: "", maxDrills: 2 },  // prompt set dynamically by backend
    { id: "financial_obligations", prompt: "What are your personal and family financial obligations?", maxDrills: 2, evalPrompt: "This is about PERSONAL and FAMILY obligations only, NOT startup funding." },
    { id: "failure_story", prompt: "Can you share a failure you experienced and what you learned from it?", maxDrills: 2, evalPrompt: "Accept ANY failure (childhood, academic, personal, professional). Never ask for a 'bigger' one. Must include what failed + lesson learned." },
    { id: "hobbies", prompt: "What are your hobbies or interests outside of work?", maxDrills: 2 },
    { id: "the_why", prompt: "What motivates you to build this startup?", maxDrills: 2 },

    // ── Phase 2: Business ──
    { id: "startup_idea", prompt: "Tell me about your startup idea — what problem are you solving and what is your solution?", maxDrills: 2 },
    { id: "zone_1_desirability", prompt: "Who are your target customers and why would they want this?", maxDrills: 2 },
    { id: "zone_2_viability", prompt: "What is your business model and how will you generate revenue?", maxDrills: 2 },
    { id: "zone_3_feasibility", prompt: "Do you have the technical capability and team to build this?", maxDrills: 2 },
    { id: "zone_4_defensibility", prompt: "What makes your solution hard to replicate?", maxDrills: 2 },
    { id: "zone_5_affordability", prompt: "How does your pricing fit within the Indian market?", maxDrills: 2 },

    // ── Phase 3: AI & IndiaAI ──
    { id: "ai_interest", prompt: "What got you interested in AI? Was there a specific moment or problem that drew you to it?", maxDrills: 2 },
    { id: "ai_necessity", prompt: "Why does your product specifically require AI? Would it not be possible to build this without AI?", maxDrills: 2 },
    { id: "ai_ecosystem_contribution", prompt: "How do you think your product will contribute to the Indian AI ecosystem?", maxDrills: 2 },
    { id: "indiaai_awareness", prompt: "Are you aware of the IndiaAI Mission?", maxDrills: 2 },
    { id: "indiaai_alignment", prompt: "How does your product empower the IndiaAI Mission?", maxDrills: 2 },

    // ── Phase 4: Closing ──
    { id: "company_name", prompt: "What is the name of your company or startup?", maxDrills: 2 },
    { id: "company_incorporated", prompt: "Is your company legally incorporated? If yes, could you share when it was incorporated?", maxDrills: 2 },
    { id: "pitch_deck", prompt: "Do you have a pitch deck? If yes, please upload it.", maxDrills: 2 },
    { id: "website", prompt: "Do you have a website? If yes, please share the URL.", maxDrills: 2 },
];

// ─── LLM Prompt (simplified: evaluate + generate wording only) ──────

const FSM_EVAL_PROMPT = `You are FounderCheck, a warm and curious interviewer for ITEL Foundation.
Your TWO jobs: (1) evaluate whether the user's answer adequately covers the topic, and (2) generate natural conversational text.

OUTPUT FORMAT — RAW JSON ONLY, no markdown, no backticks:
{
  "answered": true/false,
  "response": "Your text (see rules below for what to write)"
}

RULES FOR "answered":
1. answered=true ONLY if the answer contains CONCRETE, SPECIFIC information (names, numbers, examples, clear explanations).
2. answered=false if the answer is vague, generic, uses buzzwords without evidence, or is missing key parts.
3. If the user explicitly refuses to answer (e.g., "I'd rather not say"), set answered=true (accept refusal gracefully).

BE A STRICT SKEPTIC WHEN EVALUATING:
- "We have great traction" without metrics → answered=false
- "Our product is innovative/disruptive" without explaining HOW → answered=false
- "We plan to monetize through multiple channels" without naming them → answered=false
- A one-liner for a complex topic (like life goals, business model, or failure story) → answered=false
- Buzzwords + no specifics = answered=false. Buzzwords + concrete data = answered=true.
- When in doubt, set answered=false. It's better to ask one follow-up than to accept a shallow answer.

RULES FOR "response":
- If answered=true: Write ONLY a warm 1-sentence acknowledgment of what they said. Examples:
  "That's a really solid background — thanks for sharing!"
  "I can see you've thought deeply about this, that's great."
  "Interesting perspective, I appreciate your honesty."
  Do NOT ask any question. Do NOT mention the next topic. The system will append the next question automatically.
- If answered=false: Write a friendly follow-up that specifically points out what's missing. Examples:
  "That sounds promising! Could you share some specific numbers or metrics to back that up?"
  "I'd love to understand this better — can you walk me through a concrete example?"
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
}

export async function runConductorFSM(input: FSMInput): Promise<FSMResult> {
    const { userMessage, stepIndex, drillCount, conversationHistory } = input;

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
        const isSolo = input.founderIsSolo ?? /solo|by myself|just me|alone/i.test(userMessage);
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

    // ── SPECIAL: indiaai_awareness — if NO, skip indiaai_alignment ──
    // We handle this AFTER evaluating the answer (see below)

    // ── Determine the NEXT step's prompt (for transition wording) ──
    const nextStepIndex = stepIndex + 1;
    const nextStep = nextStepIndex < STEPS.length ? STEPS[nextStepIndex] : null;
    const nextTopicHint = nextStep
        ? `The next topic is "${nextStep.id}". The fallback question for it is: "${nextStep.prompt}"`
        : "The interview is about to end. Thank the user.";

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

${nextTopicHint}

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
                maxOutputTokens: 512,
            });

            console.log(`🤖 FSM eval (attempt ${attempt + 1}, ${text.length} chars)`);

            if (!text || text.trim().length === 0) {
                console.warn(`⚠️ Empty LLM response (attempt ${attempt + 1})`);
                continue;
            }

            // Extract JSON
            let jsonStr = text.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonStr = jsonMatch[1].trim();
            const firstBrace = jsonStr.indexOf("{");
            const lastBrace = jsonStr.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(jsonStr);

            // ── Zod Validation ──
            const zodResult = ConductorEvalSchema.safeParse(parsed);
            if (!zodResult.success) {
                console.warn(`⚠️ Zod validation failed (attempt ${attempt + 1}):`, zodResult.error.flatten());
                continue; // Auto-retry
            }

            const { answered, response } = zodResult.data;

            // ── Force advance if max drills reached ──
            const effectiveAnswered = answered || drillCount >= currentStep.maxDrills;

            if (effectiveAnswered) {
                // ── ADVANCE to next step ──
                let advanceTo = stepIndex + 1;
                let finalResponse = response; // Default: use LLM's generated text

                // SPECIAL: founder_status_step1 → override with hard-coded step2 question
                if (currentStep.id === "founder_status_step1") {
                    const isSolo = /solo|by myself|just me|alone/i.test(userMessage);
                    finalResponse = isSolo
                        ? "How do you plan to manage Product, Sales, and Tech all by yourself?"
                        : "How do you split Product, Sales, and Tech among your team?";
                    console.log(`🛡️ FSM: founder_status_step1 answered. SOLO=${isSolo}. Hard-coded step2 question injected.`);

                    return {
                        response: finalResponse,
                        nextStepIndex: advanceTo,       // advance to step2
                        nextDrillCount: 1,              // so step2 evaluates the answer next call
                        checklistUpdate: undefined,     // don't mark founder_status complete yet
                        isComplete: false,
                        founderIsSolo: isSolo,
                    };
                }

                // SPECIAL: indiaai_awareness → if user said NO, skip indiaai_alignment
                if (currentStep.id === "indiaai_awareness") {
                    const saidNo = /\bno\b|not aware|haven't heard|don't know/i.test(userMessage);
                    if (saidNo) {
                        // Skip indiaai_alignment (advance by 2)
                        advanceTo = stepIndex + 2;
                        console.log("🛡️ FSM: User not aware of IndiaAI Mission — skipping indiaai_alignment");
                    }
                }

                // Map step IDs to checklist keys for backward compatibility
                const checklistKey = currentStep.id.replace(/_step[12]$/, "");

                // HYBRID: Combine LLM acknowledgment + hardcoded next question
                if (advanceTo >= STEPS.length) {
                    // Interview is DONE — closing message
                    const ack = response ? response.trim() : "";
                    finalResponse = ack
                        ? `${ack}\n\nThank you for completing the interview! We will now generate your evaluation report.`
                        : "Thank you for completing the interview! We will now generate your evaluation report.";
                } else {
                    const hardcodedQuestion = STEPS[advanceTo].prompt;
                    const ack = response ? response.trim() : "";
                    // Combine: warm acknowledgment + hardcoded question
                    finalResponse = ack && hardcodedQuestion
                        ? `${ack}\n\n${hardcodedQuestion}`
                        : hardcodedQuestion || finalResponse;
                }

                return {
                    response: finalResponse,
                    nextStepIndex: advanceTo,
                    nextDrillCount: 0,
                    checklistUpdate: { key: checklistKey, value: true },
                    isComplete: advanceTo >= STEPS.length,
                    founderIsSolo: input.founderIsSolo,
                };
            } else {
                // ── DRILL DOWN: stay on current step ──
                return {
                    response,
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
    console.warn("⚠️ All LLM attempts failed. Using hardcoded fallback.");

    // Force advance if we've drilled enough, otherwise stay
    if (drillCount >= currentStep.maxDrills) {
        const checklistKey = currentStep.id.replace(/_step[12]$/, "");
        return {
            response: STEPS[stepIndex + 1]?.prompt || "Thank you! Your interview is complete.",
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

// ─── Helper: Get initial checklist (backward compat for reports) ─────

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

/**
 * Get the initial conversation summary.
 */
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
