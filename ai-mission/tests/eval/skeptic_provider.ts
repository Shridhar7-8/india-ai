import { runSkeptic } from "../../src/agents/skeptic";

export default async function provider(prompt: string, vars: any) {
  const { userMessage, currentTopic, history, redFlags, greenFlags } = vars;

  const input = {
    userMessage: userMessage || prompt,
    currentTopic: currentTopic || "unknown",
    conversationHistory: history || [],
    existingRedFlags: redFlags || [],
    existingGreenFlags: greenFlags || [],
  };

  try {
    const result = await runSkeptic(input);
    return {
      output: JSON.stringify(result, null, 2),
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}
