import { runConductorFSM } from "../../src/agents/conductor";

export default async function provider(prompt: string, vars: any) {
  const { userMessage, stepIndex, drillCount, history, founderIsSolo } = vars;

  const input = {
    userMessage: userMessage || prompt,
    stepIndex: parseInt(stepIndex) || 0,
    drillCount: parseInt(drillCount) || 0,
    conversationHistory: history || [],
    founderIsSolo: founderIsSolo === 'true' || founderIsSolo === true,
  };

  try {
    const result = await runConductorFSM(input);
    return {
      output: JSON.stringify(result, null, 2),
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}
