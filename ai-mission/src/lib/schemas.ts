import { z } from "zod";

// ─── API Request Schemas ────────────────────────────────────────────

export const MessageCreateSchema = z.object({
    conversationId: z.coerce.number().optional(),
    content: z.string().min(1, "Message cannot be empty"),
});
export type MessageCreate = z.infer<typeof MessageCreateSchema>;

export const ConversationCreateSchema = z.object({
    title: z.string().optional().default("New Conversation"),
});
export type ConversationCreate = z.infer<typeof ConversationCreateSchema>;

export const ConversationUpdateSchema = z.object({
    title: z.string().min(1).max(255),
});
export type ConversationUpdate = z.infer<typeof ConversationUpdateSchema>;

// ─── Conductor Agent Response Schema ────────────────────────────────

export const ConductorResponseSchema = z.object({
    reasoning: z.string(),
    checklist_updates: z.record(z.string(), z.boolean()).default({}),
    decision: z.string(),
    response: z.string(),
});
export type ConductorResponse = z.infer<typeof ConductorResponseSchema>;

// ─── FSM Conductor Eval Schema (new simplified LLM output) ──────────

export const ConductorEvalSchema = z.object({
    answered: z.boolean(),          // Did the user adequately answer the topic?
    response: z.string(),           // LLM's generated question or follow-up text (can be empty string)
    is_off_topic: z.boolean().default(false), // Flag if the user input is completely irrelevant/rubbish
});
export type ConductorEval = z.infer<typeof ConductorEvalSchema>;

// ─── Report Chunk Schemas (split into 4 small calls) ────────────────
// NOTE: No z.preprocess — normalization happens in analyst.ts normalizeBeforeZod()

export const FounderChunkSchema = z.object({
    founder_name: z.string().max(100),
    founder_background: z.string().max(400),
    why_entrepreneurship: z.string().max(300).default("Not discussed in interview"),
    financial_commitments: z.string().max(200).default("Not discussed in interview"),
    goals: z.string().max(400).default("Not discussed in interview"),
    grit_score: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"),
    grit_evidence: z.string().max(250).default("Not discussed in interview"),
    business_thinking: z.string().max(300).default("Not discussed in interview"),
    founder_structure: z.enum(["Solo founder", "Co-founder team"]).default("Solo founder"),
    hobbies: z.string().max(200).default("Not discussed in interview"),
});

export const SolutionChunkSchema = z.object({
    idea: z.string().max(500),
    macro_context: z.string().max(200).default("Not discussed in interview"),
    why_ai: z.string().max(300).default("Not discussed in interview"),
    development_stage: z.enum(["Idea", "Concept", "Prototype", "Early MVP", "MVP", "Growth", "Not specified"]).default("Not specified"),
    assets: z.string().max(300).default("Not discussed in interview"),
});

export const ScorecardChunkSchema = z.object({
    desirability_score: z.enum(["PASS", "MODERATE", "FAIL"]),
    desirability_note: z.string().max(250).default("Not discussed in interview"),
    viability_score: z.enum(["PASS", "MODERATE", "FAIL"]),
    viability_note: z.string().max(250).default("Not discussed in interview"),
    feasibility_score: z.enum(["PASS", "MODERATE", "FAIL"]),
    feasibility_note: z.string().max(250).default("Not discussed in interview"),
    defensibility_score: z.enum(["PASS", "MODERATE", "FAIL"]),
    defensibility_note: z.string().max(250).default("Not discussed in interview"),
    affordability_score: z.enum(["PASS", "MODERATE", "FAIL"]),
    affordability_note: z.string().max(250).default("Not discussed in interview"),
});

export const AssessmentChunkSchema = z.object({
    red_flags: z.string(),
    green_flags: z.string(),
    mission_fit: z.enum(["HIGH", "MEDIUM", "LOW"]),
    indiaai_pillar: z.enum([
        "IndiaAI Innovation Centre",
        "IndiaAI Application Development Initiative",
        "AIKosh",
        "IndiaAI Compute Capacity",
        "IndiaAI Startup Financing",
        "IndiaAI FutureSkills",
        "Safe & Trusted AI",
        "None",
    ]),
    indiaai_awareness: z.string(),
    mission_fit_reasoning: z.string(),
    verdict: z.enum([
        "SEEMS LIKE A GOOD FIT",
        "UNSURE — MORE VALIDATION REQUIRED",
        "DOESN'T SEEM LIKE A GOOD FIT",
    ]),
    verdict_reasoning: z.string(),
});

// ─── Split Assessment into smaller chunks for reliability ────────────

export const FlagsChunkSchema = z.object({
    red_flags: z.string().max(800).default("None"),
    green_flags: z.string().max(800).default("None"),
    mission_fit: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export const VerdictChunkSchema = z.object({
    indiaai_pillar: z.enum([
        "IndiaAI Innovation Centre",
        "IndiaAI Application Development Initiative",
        "AIKosh",
        "IndiaAI Compute Capacity",
        "IndiaAI Startup Financing",
        "IndiaAI FutureSkills",
        "Safe & Trusted AI",
        "None",
    ]),
    indiaai_awareness: z.enum(["Aware", "Not aware"]),
    mission_fit_reasoning: z.string().max(500).default("Not discussed in interview"),
    verdict_reasoning: z.string().max(400).default("Not discussed in interview"),
});

// ─── Database Row Types ─────────────────────────────────────────────


export interface Conversation {
    id: number;
    clerk_user_id: string;
    title: string;
    status: "active" | "completed" | "archived";
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: number;
    conversation_id: number;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
}

export interface InterviewChecklist {
    name: boolean;
    professional_background: boolean;
    education_background: boolean;
    life_goals: boolean;
    startup_vs_technology: boolean;
    founder_status: boolean;
    financial_obligations: boolean;
    failure_story: boolean;
    hobbies: boolean;
    the_why: boolean;
    startup_idea: boolean;
    zone_1_desirability: boolean;
    zone_2_viability: boolean;
    zone_3_feasibility: boolean;
    zone_4_defensibility: boolean;
    zone_5_affordability: boolean;
    ai_interest: boolean;
    ai_necessity: boolean;
    ai_ecosystem_contribution: boolean;
    indiaai_awareness: boolean;
    indiaai_alignment: boolean;
    company_name: boolean;
    company_incorporated: boolean;
    pitch_deck_and_website: boolean;
}

export interface ConversationSummary {
    founder_name: string | null;
    startup_idea: string | null;
    startup_description: string | null;
    company_name: string | null;
    company_incorporated: string | null;
    key_features: string[];
    background_summary: string | null;
    challenges_mentioned: string[];
    tech_stack: string[];
    refusals: string[];
    clear_negatives: string[];
    ai_interest_summary: string | null;
    indiaai_aware: boolean | null;
    indiaai_alignment_summary: string | null;
}

export interface InterviewState {
    id: number;
    conversation_id: number;
    checklist: InterviewChecklist;
    drill_down_counts: Record<string, number>;
    current_phase: string;
    red_flags: Array<{ category: string; description: string }>;
    is_complete: boolean;
    pitch_deck_url: string | null;
    pitch_deck_filename: string | null;
    website_url: string | null;
    conversation_summary: ConversationSummary;
    topics_asked: Record<string, {
        asked_count: number;
        last_turn: number;
        response_type: string;
        summary: string;
    }>;
    turn_count: number;
    created_at: string;
    updated_at: string;
}
