import { runAnalyst } from "../../src/agents/analyst";
import { buildSkepticSummary } from "../../src/agents/skeptic";
import { readFileSync } from "fs";
import * as dotenv from "dotenv";
import { resolve } from "path";

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
    const { history, redFlags, greenFlags, companyName, pitchDeckUrl, websiteUrl } = parsedInput;

    const skepticSummary = buildSkepticSummary(redFlags ?? [], greenFlags ?? []);

    const result = await runAnalyst({
      conversationHistory: history ?? [],
      skepticSummary,
      companyName: companyName ?? undefined,
      pitchDeckUrl: pitchDeckUrl ?? undefined,
      websiteUrl: websiteUrl ?? undefined,
    });

    // Output structured result for assertions
    console.log(
      JSON.stringify({
        report: result,
        hasReport: typeof result === "string" && result.length > 100,
        hasScorecard: result.includes("5-ZONE SCORECARD"),
        hasFounderProfile: result.includes("FOUNDER PROFILE"),
        hasMissionFit: result.includes("MISSION FIT"),
        hasFinalScore: result.includes("FINAL SCORE"),
        hasFlags: result.includes("FLAGS"),
        isError: result.startsWith("ERROR:"),
      })
    );
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message, stack: error.stack }));
    process.exit(1);
  }
}

main();
