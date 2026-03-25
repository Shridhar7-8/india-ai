import { runConductorFSM } from "../../src/agents/conductor";

export default async function provider(prompt: string, vars: Record<string, unknown>) {
  const { userMessage, stepIndex, drillCount, history, founderIsSolo } = vars;

  const input = {
    userMessage: (userMessage as string) || prompt,
    stepIndex: parseInt(stepIndex as string) || 0,
    drillCount: parseInt(drillCount as string) || 0,
    conversationHistory: (history as Array<{ role: string; content: string }>) || [],
    founderIsSolo: founderIsSolo === 'true' || founderIsSolo === true,
  };

  try {
    const result = await runConductorFSM(input);
    return {
      output: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      error: (error as Error).message,
    };
  }
}
