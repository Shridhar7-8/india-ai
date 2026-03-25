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

// ─── Unified Report Schema (Single Call Output) ──────────────────────

export const UnifiedReportSchema = z.object({
    // SECTION 1 — FOUNDER PROFILE
    founder_name: z.string().max(100),
    company_name: z.string().max(200).default("Not specified"),
    company_name_evidence: z.array(z.string()),
    professional_background: z.string().max(300),
    professional_background_evidence: z.array(z.string()),
    education_background: z.string().max(200),
    education_background_evidence: z.array(z.string()),
    hobbies: z.string().max(200).default("Not specified"),
    hobbies_evidence: z.array(z.string()),
    why_entrepreneurship: z.string().max(300).default("Not specified"),
    why_entrepreneurship_evidence: z.array(z.string()),
    financial_commitments: z.string().max(200).default("Not specified"),
    financial_commitments_evidence: z.array(z.string()),
    goals_short_term: z.string().max(200).default("Not specified").describe("Founder's short-term goals"),
    goals_short_term_evidence: z.array(z.string()),
    goals_mid_term: z.string().max(200).default("Not specified").describe("Founder's mid-term goals"),
    goals_mid_term_evidence: z.array(z.string()),
    goals_long_term: z.string().max(200).default("Not specified").describe("Founder's long-term goals"),
    goals_long_term_evidence: z.array(z.string()),

    // Grit / Failure Story Evaluation (out of 2)
    grit_evaluation: z.enum([
        "Specific failure described in detail. Concrete recovery actions taken. Clear lesson learned that visibly shaped how they think or work today.", // 2
        "Specific failure mentioned with mostly concrete recovery. Lesson articulated, may lack full depth but shows genuine reflection.", // 1.5
        "Failure mentioned but vague on recovery steps and lessons learned.", // 0.5
        "No failure story or very vague failure story. Topic avoided. No evidence of recovery, resilience or learning.", // 0
        "Not specified" // 0
    ]),
    grit_evaluation_evidence: z.array(z.string()).describe("Exact transcript quotes supporting the grit evaluation"),
    grit_evaluation_reasoning: z.string().max(400).describe("3-4 sentences justifying the grit evaluation based on evidence"),

    // Business Thinking Evaluation (out of 1)
    business_thinking_evaluation: z.enum([
        "Founder clearly explains how a startup is about running, operating and growing a business beyond just technology.", // 1
        "Founder unable to clearly explain how a startup is not just technology but about running, operating and growing a business.", // 0
    ]),

    business_thinking: z.string().max(300).default("Not specified"),
    business_thinking_evidence: z.array(z.string()),

    founder_structure: z.enum(["Solo founder", "Co-founder team"]).default("Solo founder"),
    founder_structure_evidence: z.array(z.string()),
    role_division: z.string().max(300).default("Not specified").describe("How they plan to manage alone or how the co-founders split roles"),
    role_division_evidence: z.array(z.string()),

    // Team Division Evaluation (out of 1)
    team_division_evaluation: z.enum([
        "2 or 3 total co-founders.", // 1
        "4 or more total co-founders.", // 0.5
        "Solo founder. No co-founders.", // 0
    ]),

    // Financial Commitments Evaluation (out of 1)
    financial_commitments_evaluation: z.enum([
        "No financial commitments or obligations.", // 1
        "Financial commitments or obligations exist.", // 0
    ]),

    // SECTION 2 — SOLUTION SNAPSHOT
    idea: z.string().max(500),
    idea_evidence: z.array(z.string()),
    macro_context: z.string().max(200).default("Not specified"),
    macro_context_evidence: z.array(z.string()),
    development_stage: z.enum(["Idea", "Concept", "Prototype", "Early MVP", "MVP", "Growth", "Not specified"]).default("Not specified"),
    development_stage_evidence: z.array(z.string()),

    // SECTION 3 — 5-ZONE SCORECARD
    desirability_evaluation: z.enum([
        "Problem and target user defined very clearly with specifics provided and clear evidence of demand mentioned.", // 5
        "Problem and target user defined very clearly with specifics provided but no clear evidence of demand mentioned.", // 4
        "Problem and target user defined however minor gaps in specificity and no clear evidence of demand mentioned.", // 2.5
        "Problem mentioned but too broad. Target market not clearly defined and evidence of demand not mentioned.", // 1
        "Weak problem articulation. No clear user definition. No evidence of demand.", // 0.5
        "No clear problem. No market exists or will want this solution. Solution looking for a problem.", // 0
    ]),
    desirability_evidence: z.array(z.string()),
    desirability_note: z.string().max(300).describe("Exactly 2 sentences explaining why"),

    viability_evaluation: z.enum([
        "Solid well-defined revenue model and profitability and scalability seems quite possible.", // 5
        "Solid well-defined revenue model but profitability and scalability is unclear.", // 4
        "Revenue model exists but vague. Path to profitability and scalability is unclear.", // 2
        "Revenue model mentioned but not defined properly. Economics don't seem to work. Profitability seems difficult. Scalability doesn't seem possible.", // 0.5
        "No revenue model defined. No monetisation thinking. Economics fundamentally don't work. Scalability not considered.", // 0
    ]),
    viability_evidence: z.array(z.string()),
    viability_note: z.string().max(300).describe("Exactly 2 sentences explaining why"),

    feasibility_evaluation: z.enum([
        "Technical capability clearly explained. Realistic build plan provided.", // 5
        "Technical capability evident. Build plan mostly realistic. Minor complexity underestimated.", // 4
        "Technical capability evident but build plan doesn't exist.", // 2.5
        "Possible to build but unclear technical capacity and underestimating complexity.", // 1
        "Significant technical gaps. Unclear how they'd actually build this. Unrealistic thinking.", // 0.5
        "No technical capability. Major legal barriers ignored. Delusional or unrealistic thinking.", // 0
    ]),
    feasibility_evidence: z.array(z.string()),
    feasibility_note: z.string().max(300).describe("Exactly 2 sentences explaining why"),

    defensibility_evaluation: z.enum([
        "At least 1 strong moat clearly defined and proven: very strong network, proprietary tech/IP, unique data, breakthrough technology, or very unique insight.", // 5
        "One credible moat identified and clearly articulated but only exists on paper, not yet fully built or proven.", // 3.5
        "Some differentiation exists but doesn't create a strong competitive advantage. E.g. first-mover advantage only.", // 2
        "Very weak differentiation. Very easy to replicate. No credible moat identified.", // 0.5
        "No differentiator. Completely replicable. No moat thinking. Anyone can build it very easily.", // 0
    ]),
    defensibility_evidence: z.array(z.string()),
    defensibility_note: z.string().max(300).describe("Exactly 2 sentences explaining why"),

    affordability_evaluation: z.enum([
        "Pricing clearly fits the Indian target segment. Founder has defined exact pricing with proper research about pricing in India in that segment.", // 5
        "India context considered meaningfully but pricing is not yet fully defined.", // 3.5
        "Pricing and affordability not considered proactively. Has shown some thought of India-first pricing when asked but had not considered it until now.", // 2
        "Pricing not thought through for India. Weak India context. Doesn't show much regard for Indian context in pricing.", // 0.5
        "Delusional pricing that does not fit the Indian market. No thought given to affordability.", // 0
    ]),
    affordability_evidence: z.array(z.string()),
    affordability_note: z.string().max(300).describe("Exactly 2 sentences explaining why"),

    // SECTION 4 — FLAGS
    // (Flags are now injected directly from the Skeptic module, not parsed by Analyst)

    // SECTION 5 — AI MISSION FIT (out of 3)
    mission_fit_evaluation: z.enum([
        "AI is indispensable to the product, credible pillar connection, clear ecosystem contribution, and founder is aware of IndiaAI Mission.", // 3
        "AI is indispensable to the product, credible pillar connection, clear ecosystem contribution, but founder is unaware of IndiaAI Mission.", // 2.5
        "AI is indispensable to the product, credible pillar connection, but ecosystem contribution is unclear and founder is unaware of IndiaAI Mission.", // 2
        "AI is indispensable to the product but no credible pillar connection, ecosystem contribution is unclear and founder is unaware of IndiaAI Mission.", // 1
        "No credible AI mission pillar connection. AI is decorative or an add-on feature. Product can be built without AI. Founder is unaware of IndiaAI Mission.", // 0
    ]),
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
    mission_fit_reasoning: z.string().max(600).describe("1 PARAGRAPH — explain the score. Cover: is AI structurally core or decorative? Is the India connection genuine or retrofitted? Does the startup contribute to the IndiaAI ecosystem? What is the founder's awareness of the IndiaAI Mission?"),
    mission_fit_reasoning_evidence: z.array(z.string()),

    // SECTION 6 — OVERALL SUMMARY
    overall_summary: z.string().max(1000).describe("4–5 SENTENCES. A holistic, human-readable narrative — not a list of scores. Cover: who they are as a founder, quality of their idea and business thinking, AI conviction and India-first orientation, standout strengths, and any areas of meaningful concern.")
});

export type UnifiedReport = z.infer<typeof UnifiedReportSchema>;

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
    red_flags: Array<{ category: string; description: string; _evidence: string[] }>;
    green_flags: Array<{ category: string; description: string; _evidence: string[] }>;
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
    vague_topics?: string[];
    created_at: string;
    updated_at: string;
}
