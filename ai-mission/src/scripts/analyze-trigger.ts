import { config } from "dotenv";
import { resolve } from "path";
// Load both .env and .env.local (Next.js stores secrets in .env.local)
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
import { createClient } from "@supabase/supabase-js";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { appendFileSync, mkdirSync } from "fs";
import { runAnalyst } from "../agents/analyst";
import { buildSkepticSummary } from "../agents/skeptic";

// ── Config ────────────────────────────────────────────────────────────
const GO_LIVE_DATE = "2026-03-15";

// Clerk user IDs for test/internal accounts — excluded from batch
const TEST_USER_IDS = new Set<string>([
  "e2e-test-user-123",
  "e2e-report-test-user",
]);

// ── Log file setup ────────────────────────────────────────────────────
const LOG_DIR = resolve(process.cwd(), "logs");
const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const LOG_FILE = resolve(LOG_DIR, `analyze-run-${RUN_TIMESTAMP}.log`);

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  appendFileSync(LOG_FILE, line + "\n");
}

function logRaw(msg: string) {
  appendFileSync(LOG_FILE, msg + "\n");
}

function initLogFile() {
  mkdirSync(LOG_DIR, { recursive: true });
  logRaw(`${"═".repeat(60)}`);
  logRaw(`  FounderCheck Analyze Trigger — Run Log`);
  logRaw(`  Started : ${new Date().toISOString()}`);
  logRaw(`  Log file: ${LOG_FILE}`);
  logRaw(`${"═".repeat(60)}\n`);
}

// ── Email config check ────────────────────────────────────────────────
const smtpUser = process.env.SMTP_USERNAME;
const smtpPass = process.env.SMTP_PASSWORD;
const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL;

initLogFile();

log("─────────────────────────────────────────");
log("📬 Email Config Check:");
log(`   SMTP_USERNAME      : ${smtpUser      ? `✅ ${smtpUser}`           : "❌ MISSING"}`);
log(`   SMTP_PASSWORD      : ${smtpPass      ? "✅ loaded (hidden)"       : "❌ MISSING"}`);
log(`   REPORT_RECIPIENT   : ${recipientEmail ? `✅ ${recipientEmail}`     : "❌ MISSING"}`);
log(
  smtpUser && smtpPass && recipientEmail
    ? "✅ Email is configured — report will be sent."
    : "⚠️  Email NOT configured — report will be stored but NOT emailed."
);
log("─────────────────────────────────────────\n");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  log("❌ Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const SQS_QUEUE_URL = process.env.AWS_SQS_QUEUE_URL || "";

async function processConversation(conversationId: number, conversationTitle: string): Promise<void> {
  // Fetch full transcript
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError || !messages) {
    throw new Error(`Failed to fetch messages: ${msgError?.message}`);
  }

  const conversationHistory = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  // Fetch interview state
  const { data: state, error: stateError } = await supabase
    .from("interview_states")
    .select("red_flags, green_flags, conversation_summary, vague_topics, pitch_deck_url")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (stateError || !state) {
    throw new Error(`Failed to fetch interview state: ${stateError?.message || "Not found"}`);
  }

  const convSummary = state.conversation_summary || {};
  const skepticSummary = buildSkepticSummary(
    state.red_flags || [],
    state.green_flags || []
  );

  // Run analyst
  const reportMarkdown = await runAnalyst({
    conversationHistory,
    skepticSummary,
    companyName: convSummary.company_name || conversationTitle,
    pitchDeckUrl: state.pitch_deck_url || undefined,
    websiteUrl: convSummary.website_url || undefined,
    vagueTopics: state.vague_topics || [],
  });

  if (!reportMarkdown || reportMarkdown.startsWith("ERROR:")) {
    throw new Error(`Analyst failed: ${reportMarkdown}`);
  }

  // Send to SQS
  const payload = {
    name: "interview/report_ready",
    data: {
      conversationId,
      conversationTitle,
      companyName: convSummary.company_name || conversationTitle,
      reportMarkdown,
    },
  };

  const response = await sqsClient.send(new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
    MessageBody: JSON.stringify(payload),
  }));

  if (!response.MessageId) {
    throw new Error("SQS send returned no MessageId");
  }
}

async function main() {
  if (!SQS_QUEUE_URL) {
    log("❌ Missing AWS_SQS_QUEUE_URL in .env file.");
    process.exit(1);
  }

  // Accept optional conversationId from CLI: `npm run analyze -- 42`
  const argId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  if (argId) {
    // ── Single conversation mode ───────────────────────────────────────
    log(`🔍 Looking for conversation ID ${argId}...`);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, status")
      .eq("id", argId)
      .single();

    if (error || !data) {
      log(`❌ Conversation ${argId} not found.`);
      process.exit(1);
    }

    log(`✅ Found: ID=${data.id}  Title="${data.title}"\n`);
    log(`[1/1] Processing convId=${data.id} "${data.title}"...`);

    const t0 = Date.now();
    try {
      await processConversation(data.id, data.title);
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      log(`[1/1] ✅ DONE    convId=${data.id} "${data.title}" — ${sec}s`);
      logRaw(`\n${"─".repeat(60)}`);
      logRaw(`  Result  : SUCCESS`);
      logRaw(`  convId  : ${data.id}`);
      logRaw(`  Title   : ${data.title}`);
      logRaw(`  Time    : ${sec}s`);
      logRaw(`${"─".repeat(60)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[1/1] ❌ FAILED  convId=${data.id} "${data.title}" — ${msg}`);
      logRaw(`\n${"─".repeat(60)}`);
      logRaw(`  Result  : FAILED`);
      logRaw(`  convId  : ${data.id}`);
      logRaw(`  Title   : ${data.title}`);
      logRaw(`  Error   : ${msg}`);
      logRaw(`${"─".repeat(60)}`);
      process.exit(1);
    }

  } else {
    // ── Batch mode: all real conversations since go-live ──────────────
    log(`🔍 Fetching all completed real conversations since ${GO_LIVE_DATE}...`);

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, title, clerk_user_id, created_at")
      .eq("status", "completed")
      .gte("created_at", GO_LIVE_DATE)
      .order("created_at", { ascending: true });

    if (error) {
      log(`❌ Failed to fetch conversations: ${error.message}`);
      process.exit(1);
    }

    if (!conversations || conversations.length === 0) {
      log(`❌ No completed conversations found since ${GO_LIVE_DATE}.`);
      process.exit(1);
    }

    // Filter out test users
    const realConversations = conversations.filter((c) => !TEST_USER_IDS.has(c.clerk_user_id));
    const total = realConversations.length;
    const skipped = conversations.length - total;

    log(`\n📋 Found ${conversations.length} completed conversations since ${GO_LIVE_DATE}`);
    if (skipped > 0) log(`   → ${skipped} skipped (test users)`);
    log(`   → ${total} real conversations to process`);
    log(`   → Log file: ${LOG_FILE}`);
    log("─────────────────────────────────────────\n");

    // Write manifest to log
    logRaw("CONVERSATION LIST:");
    realConversations.forEach((c, i) => {
      logRaw(`  ${String(i + 1).padStart(3)}. convId=${c.id} | ${c.created_at.substring(0, 10)} | ${c.title}`);
    });
    logRaw("\nPROCESSING LOG:");

    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    const failedIds: number[] = [];
    const results: { id: number; title: string; status: "success" | "failed"; error?: string; sec: string }[] = [];

    for (let i = 0; i < total; i++) {
      const conv = realConversations[i];
      const idx = i + 1;
      const elapsed = Date.now() - startTime;
      const avgMs = i > 0 ? elapsed / i : 0;
      const remainingMs = avgMs * (total - i);
      const etaStr = i > 0
        ? `ETA ~${Math.round(remainingMs / 60000)}m`
        : "ETA calculating...";

      const label = `[${idx}/${total}] convId=${conv.id} "${conv.title}"`;
      process.stdout.write(`${label} ... `);
      appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${label} ... `);

      const t0 = Date.now();
      let lastErr = "";
      let succeeded = false;

      // Retry up to 3 times with exponential backoff (handles transient DB connection drops)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await processConversation(conv.id, conv.title);
          succeeded = true;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
          const isNetworkErr = lastErr.includes("fetch failed") || lastErr.includes("terminated") || lastErr.includes("ECONNRESET");
          if (attempt < 3 && isNetworkErr) {
            const waitSec = attempt * 5;
            const retryMsg = `   ⚠ Attempt ${attempt} failed (${lastErr}) — retrying in ${waitSec}s...`;
            console.log(retryMsg);
            appendFileSync(LOG_FILE, retryMsg + "\n");
            await new Promise((r) => setTimeout(r, waitSec * 1000));
          } else {
            break;
          }
        }
      }

      if (succeeded) {
        successCount++;
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
        const line = `✅ DONE  (${sec}s | ${elapsedSec}s total | ${etaStr})`;
        console.log(line);
        appendFileSync(LOG_FILE, line + "\n");
        results.push({ id: conv.id, title: conv.title, status: "success", sec });
      } else {
        failCount++;
        failedIds.push(conv.id);
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        const line = `❌ FAILED (${sec}s) — ${lastErr}`;
        console.log(line);
        appendFileSync(LOG_FILE, line + "\n");
        results.push({ id: conv.id, title: conv.title, status: "failed", error: lastErr, sec });
      }

      // Small cooldown between conversations to avoid exhausting the Supabase connection pool
      if (i < total - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    // ── Summary ───────────────────────────────────────────────────────
    const totalMs = Date.now() - startTime;
    const totalMin = (totalMs / 60000).toFixed(1);

    const summaryLines = [
      "",
      "═".repeat(60),
      "  BATCH COMPLETE — SUMMARY",
      "═".repeat(60),
      `  Finished    : ${new Date().toISOString()}`,
      `  Total       : ${total}`,
      `  ✅ Success  : ${successCount}`,
      `  ❌ Failed   : ${failCount}`,
      `  ⏱ Time      : ${totalMin} minutes`,
      "",
      "  COMPLETED CONVERSATIONS:",
      ...results
        .filter((r) => r.status === "success")
        .map((r) => `    ✅ convId=${r.id} | ${r.sec}s | ${r.title}`),
    ];

    if (failedIds.length > 0) {
      summaryLines.push("");
      summaryLines.push("  FAILED CONVERSATIONS:");
      results
        .filter((r) => r.status === "failed")
        .forEach((r) => summaryLines.push(`    ❌ convId=${r.id} | ${r.title} | ${r.error}`));
      summaryLines.push("");
      summaryLines.push(`  Retry: npm run analyze -- <id>`);
    }

    summaryLines.push("═".repeat(60));

    summaryLines.forEach((line) => {
      console.log(line);
      appendFileSync(LOG_FILE, line + "\n");
    });

    log(`\n📁 Full log saved to: ${LOG_FILE}`);
  }
}

main().catch((err) => {
  log(`❌ Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
