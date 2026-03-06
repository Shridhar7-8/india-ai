-- Add vague_topics column to interview_states
-- Run this in your Supabase SQL Editor

ALTER TABLE interview_states
ADD COLUMN IF NOT EXISTS vague_topics JSONB DEFAULT '[]'::jsonb;
