-- Migration to create the feedbacks table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    reflection_score INTEGER NOT NULL CHECK (reflection_score >= 1 AND reflection_score <= 5),
    difficulties TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Add Row Level Security (RLS) policies if needed
-- ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable insert for authenticated users only" ON "public"."feedbacks" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Enable read access for service role only" ON "public"."feedbacks" AS PERMISSIVE FOR SELECT TO service_role USING (true);
