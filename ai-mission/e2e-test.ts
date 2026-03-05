async function runComprehensiveE2ETest() {
    console.log("🚀 Starting Comprehensive End-to-End IndiaAI Auto-Test 🚀\n");
    const baseUrl = "http://localhost:3000";

    try {
        // 1. Create a new conversation
        console.log("📝 Creating new conversation...");
        const convRes = await fetch(`${baseUrl}/api/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-e2e-userid": "e2e-test-user-123"
            },
            body: JSON.stringify({ title: "Full E2E IndiaAI Auto-Test" }),
        });

        if (!convRes.ok) throw new Error(`Failed to create conversation: ${await convRes.text()}`);
        const convData = await convRes.json();
        const conversationId = convData.id;
        console.log(`✅ Conversation created! ID: ${conversationId}\n`);

        // Simulated answers — one per STEP in the FSM STEPS array.
        // founder_status is split into step1 (solo/cofounders?) and step2 (how manage?).
        const simulatedAnswers = [
            "Hi, my name is Shridhar Kumar.",                                     // 0. name
            "I spent 5 years as a Product Manager at Google and I'm a 2x founder.", // 1. professional_background
            "I have a B.Tech in Computer Science from IIT Delhi.",                  // 2. education_background
            "My short-term goal is to launch the MVP in 3 months. Mid-term is to hit 10k highly engaged users, and long-term is to become the industry standard for AI validation.", // 3. life_goals
            "I know that a startup is absolutely a business first. Technology is just an enabler; my primary focus right now is on distribution and optimizing CAC.", // 4. startup_vs_technology
            "I am building this as a solo founder.",                               // 5. founder_status_step1
            "I manage Product and Tech myself, and I am actively looking to hire a sales lead to handle Sales.", // 6. founder_status_step2
            "I am lucky to have minimal personal financial obligations and no dependents, so I'm fully dedicated to the startup full-time.", // 7. financial_obligations
            "In my previous startup, we failed because we built for 8 months without validating willingness to pay. I learned crucial go-to-market lessons and still managed to pay back all my early investors.", // 8. failure_story
            "Outside of work, I am a classical musician.",                          // 9. hobbies
            "I am building this because I am driven to democratize access to AI evaluation for early-stage Indian startups so they don't make the same mistakes I did.", // 10. the_why
            "My startup idea is VentureLens AI. Problem: Startups waste time and money building wrong products. Solution: An AI interviewer that acts as a ruthless VC to validate ideas for early-stage founders.", // 11. startup_idea
            "Our target customers are early-stage Indian founders looking for their first checks. They desperately need validation to save time.", // 12. zone_1_desirability
            "Our business model is a simple B2B SaaS. We will charge a $20/month subscription.", // 13. zone_2_viability
            "Yes, I have the technical background to build complex agentic flows, and I'm leveraging modern LLM architectures.", // 14. zone_3_feasibility
            "Our defensibility relies on proprietary interview data and our custom assessment rubrics. It will build a significant data moat over time.", // 15. zone_4_defensibility
            "The intended $20/month pricing is well within range for Indian founders, making it highly affordable.", // 16. zone_5_affordability
            "I got interested in AI when I saw how LLMs could simulate human reasoning during a hackathon at Google. That was my 'aha' moment.", // 17. ai_interest
            "The product requires AI to conduct dynamic, context-aware, multi-agent conversational interviews that simulate real VC pressure. This is impossible with static forms.", // 18. ai_necessity
            "VentureLens will contribute to the Indian AI ecosystem by ensuring capital and talent flow toward validated ideas, creating a much stronger baseline for local innovation.", // 19. ai_ecosystem_contribution
            "Yes, I am very aware of the IndiaAI Mission.",                         // 20. indiaai_awareness
            "We align with the IndiaAI Mission by building a tool that helps other Indian startups succeed and validate faster. It falls cleanly into the 'Application Development' pillar and creates a multiplier effect for the ecosystem.", // 21. indiaai_alignment
            "VentureLens AI Private Limited.",                                      // 22. company_name
            "Yes, we are incorporated as a Private Limited company.",                // 23. company_incorporated
            "I don't have a pitch deck ready yet.",                                  // 24. pitch_deck
            "Yes, my website is venturelens.ai",                                        // 25. website
        ];

        let isComplete = false;

        // 2. Loop through messages
        for (let i = 0; i < simulatedAnswers.length; i++) {
            if (isComplete) break;

            const userText = simulatedAnswers[i];
            console.log(`\x1b[36m👤 USER:\x1b[0m ${userText}`);

            console.log("⏳ Waiting for AI Response...");
            const chatRes = await fetch(`${baseUrl}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-e2e-userid": "e2e-test-user-123"
                },
                body: JSON.stringify({
                    conversationId,
                    content: userText,
                }),
            });

            if (!chatRes.ok) throw new Error(`Chat API failed: ${await chatRes.text()}`);

            const chatData = await chatRes.json();

            const aiText = chatData.response || chatData.reply || chatData.message?.content || JSON.stringify(chatData);
            const stepIdx = chatData.stepIndex ?? "?";
            console.log(`\x1b[35m🤖 AI (step ${stepIdx}):\x1b[0m ${aiText}\n`);

            if (chatData.isComplete === true || aiText.includes("terminate") || aiText.includes("conclude") || aiText.includes("generate your report")) {
                isComplete = true;
                console.log("🏁 AI indicated the interview is complete!");
            }

            // Wait 2.5 seconds between turns to simulate natural pacing and avoid local rate limits
            await new Promise(resolve => setTimeout(resolve, 2500));
        }

        console.log("🎉 Exhaustive Interview simulation complete!");
        console.log("⏳ The 'finalize-interview' Inngest job should now be running in the background.");
        console.log("👀 Check your terminal running the Next.js server to see the PDF generation logs and wait for the email! 📧");

    } catch (e) {
        console.error("❌ E2E Test Failed:", e);
    }
}

runComprehensiveE2ETest();
