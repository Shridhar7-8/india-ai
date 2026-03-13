import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "india-ai-mission",
  eventKey: process.env.INNGEST_EVENT_KEY,
});