/**
 * Promptfoo prompt file for the Conductor FSM provider.
 * Serializes test vars into the JSON format expected by conductor_standalone.ts
 */
module.exports = async function (context) {
  const { vars } = context;
  return JSON.stringify({
    userMessage: vars.userMessage ?? "",
    stepIndex: vars.stepIndex !== undefined ? String(vars.stepIndex) : "0",
    drillCount: vars.drillCount !== undefined ? String(vars.drillCount) : "0",
    history: vars.history ?? [],
    founderIsSolo: vars.founderIsSolo ?? false,
  });
};
