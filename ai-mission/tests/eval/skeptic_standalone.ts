import { runSkeptic } from "../../src/agents/skeptic";
import { readFileSync } from "fs";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Redirect all debug/info logs to stderr BEFORE dotenv (which logs on config).
// promptfoo captures stdout as the test output; mixing logs breaks JSON.parse().
const origStdoutLog = console.log;
console.log = (...args: any[]) => console.error(...args);

dotenv.config({ path: resolve(process.cwd(), ".env") });

async function main() {
  try {
    let inputJson = "";
    if (process.argv[2]) {
      inputJson = process.argv[2];
    } else {
      inputJson = readFileSync(0, "utf-8");
    }

    if (!inputJson || inputJson.trim() === "") {
        throw new Error("No input received");
    }

    const parsedInput = JSON.parse(inputJson);
    const { userMessage, currentTopic, history, redFlags, greenFlags } = parsedInput;

    const input = {
      userMessage: userMessage || "",
      currentTopic: currentTopic || "unknown",
      conversationHistory: history || [],
      existingRedFlags: redFlags || [],
      existingGreenFlags: greenFlags || [],
    };

    const result = await runSkeptic(input);
    console.log = origStdoutLog;
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message, stack: error.stack }));
    process.exit(1);
  }
}

main();
