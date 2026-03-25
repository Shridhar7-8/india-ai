import { runSkeptic } from "../../src/agents/skeptic";
import type { RedFlag, GreenFlag } from "../../src/agents/skeptic";

export default async function provider(prompt: string, vars: Record<string, unknown>) {
  const { userMessage, currentTopic, history, redFlags, greenFlags } = vars;

  const input = {
    userMessage: (userMessage as string) || prompt,
    currentTopic: (currentTopic as string) || "unknown",
    conversationHistory: (history as Array<{ role: string; content: string }>) || [],
    existingRedFlags: (redFlags as RedFlag[]) || [],
    existingGreenFlags: (greenFlags as GreenFlag[]) || [],
  };

  try {
    const result = await runSkeptic(input);
    return {
      output: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      error: (error as Error).message,
    };
  }
}
