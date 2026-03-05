-- Add FSM columns to interview_states
-- Run this in your Supabase SQL Editor

ALTER TABLE interview_states
ADD COLUMN IF NOT EXISTS step_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_drill_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS founder_is_solo BOOLEAN DEFAULT NULL;
