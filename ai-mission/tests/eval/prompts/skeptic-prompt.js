/**
 * Promptfoo prompt file for the Skeptic agent provider.
 * Serializes test vars into the JSON format expected by skeptic_standalone.ts
 */
module.exports = async function (context) {
  const { vars } = context;
  return JSON.stringify({
    userMessage: vars.userMessage ?? "",
    currentTopic: vars.currentTopic ?? "unknown",
    history: vars.history ?? [{ role: "user", content: vars.userMessage ?? "" }],
    redFlags: vars.redFlags ?? [],
    greenFlags: vars.greenFlags ?? [],
  });
};
