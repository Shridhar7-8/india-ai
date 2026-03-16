# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FounderCheck — a multi-agent AI interview system for founder screening, built for the India-AI Mission / ITEL Foundation. Three specialized LLM agents (Conductor, Skeptic, Analyst) guide founders through a rigid 25-step interview, evaluate responses, detect red flags, and generate assessment reports.

## Repository Structure

This is a monorepo with the main Next.js 16 application in `ai-mission/`. All dev commands should be run from that directory.

## Commands

```bash
cd ai-mission

# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Testing
npm run test             # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E tests (Chromium, Firefox, WebKit)
```

Path alias: `@/*` maps to `./src/*`.

## Architecture

### Agent Orchestration (`src/agents/`)

- **Conductor** (`conductor.ts`): FSM-based interview controller. Walks through a hardcoded 25-step `STEPS` array, evaluates answers via Zod-validated LLM output (`ConductorEvalSchema`: answered/vague/off-topic), allows up to 2 drill-down follow-ups per step, and updates `interview_states` in Supabase.
- **Skeptic** (`skeptic.ts`): Runs in parallel with the conductor after each user message. Detects red flags (vague answers, inconsistencies, risk signals) and accumulates them in `interview_states.red_flags`.
- **Analyst** (`analyst.ts`): Triggered on interview completion. Generates a structured report with a 5-zone scorecard (Desirability, Viability, Feasibility, Defensibility, Affordability) using `UnifiedReportSchema`.
- **Prompts** (`prompts.ts`): Centralized system prompts for all agents.

### API Routes (`src/app/api/`)

- `POST /api/chat` — Main interview orchestration endpoint
- `/api/conversations` and `/api/conversations/[id]/messages` — CRUD for conversations
- `POST /api/feedback` — Post-interview feedback
- `POST /api/upload` — Pitch deck upload
- `POST /api/inngest/route` — Inngest webhook for background jobs

### Background Jobs (`src/inngest/`)

Inngest handles async work: finalizing interviews, generating PDF reports (`@react-pdf/renderer`), and sending email summaries via SMTP (Nodemailer).

### State Management

- **Server**: Interview state persisted in Supabase PostgreSQL (`conversations`, `messages`, `interview_states` tables). The `interview_states` table stores FSM state, checklist (JSONB with 20 boolean flags), red_flags, and conversation_summary.
- **Client**: Zustand store (`src/store/chat-store.ts`) for chat UI state.

### AI Model Providers (`src/lib/`)

Pluggable model layer — production uses AWS Bedrock (`bedrock.ts`), local dev can use Ollama (`ollama.ts`). Model selection is configured via env vars: `CONDUCTOR_MODEL`, `SKEPTIC_MODEL`, `ANALYST_MODEL`.

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Vercel AI SDK 6 · Clerk (auth) · Supabase (PostgreSQL) · Inngest (background jobs) · Zod 4 (validation) · Zustand (state) · AWS Bedrock / Ollama (LLM providers)

## CI/CD

GitHub Actions (`ci-cd.yml`): lint → build → vitest → Playwright e2e → deploy (main branch only via SSH to PM2-managed production server at `/var/www/buildai/ai-mission`).

## Database Migrations

SQL migrations live in `ai-mission/supabase/`. Key tables: `conversations`, `messages`, `interview_states`, plus a feedback table. Auto-managed timestamps via PostgreSQL triggers.
