-- ============================================
-- India-AI Mission: Supabase Database Schema
-- ============================================

-- 1. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_clerk_user ON conversations(clerk_user_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- 3. Interview states table
CREATE TABLE IF NOT EXISTS interview_states (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,

  -- Director's checklist (JSON) — 20 topics
  checklist JSONB NOT NULL DEFAULT '{
    "name": false,
    "professional_background": false,
    "education_background": false,
    "life_goals": false,
    "startup_vs_technology": false,
    "founder_status": false,
    "financial_obligations": false,
    "failure_story": false,
    "hobbies": false,
    "the_why": false,
    "startup_idea": false,
    "zone_1_desirability": false,
    "zone_2_viability": false,
    "zone_3_feasibility": false,
    "zone_4_defensibility": false,
    "zone_5_affordability": false,
    "company_name": false,
    "company_incorporated": false,
    "pitch_deck": false,
    "website": false
  }'::jsonb,

  -- Drill-down tracking
  drill_down_counts JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Current phase
  current_phase TEXT NOT NULL DEFAULT 'Phase 1 - Grit',

  -- Skeptic's accumulated red flags
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Interview status
  is_complete BOOLEAN NOT NULL DEFAULT false,

  -- Assets provided by user
  pitch_deck_url TEXT,
  pitch_deck_filename TEXT,
  website_url TEXT,

  -- Conversation summary for context memory
  conversation_summary JSONB NOT NULL DEFAULT '{
    "founder_name": null,
    "startup_idea": null,
    "startup_description": null,
    "company_name": null,
    "company_incorporated": null,
    "key_features": [],
    "background_summary": null,
    "challenges_mentioned": [],
    "tech_stack": [],
    "refusals": [],
    "clear_negatives": []
  }'::jsonb,

  -- Topic tracking to prevent duplicate questions
  topics_asked JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Turn counter
  turn_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_states_conversation ON interview_states(conversation_id);

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER interview_states_updated_at
  BEFORE UPDATE ON interview_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS (optional — Clerk handles auth at the API layer)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_states ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (our API routes use service role key)
CREATE POLICY "Service role full access" ON conversations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON interview_states FOR ALL USING (true);
