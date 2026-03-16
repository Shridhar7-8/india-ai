import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const { userId } = await auth();
        const e2eUserId = req.headers.get("x-e2e-userid");
        const effectiveUserId = e2eUserId || userId;

        if (!effectiveUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { conversationId, url } = body;

        if (!conversationId) {
            return NextResponse.json({ error: "No conversationId provided" }, { status: 400 });
        }
        if (!url) {
            return NextResponse.json({ error: "No URL provided" }, { status: 400 });
        }

        // Update InterviewState with URL directly in the database
        const { error } = await supabase
            .from("interview_states")
            .update({ pitch_deck_url: url })
            .eq("conversation_id", conversationId);

        if (error) {
            console.error("❌ Update error:", error);
            return NextResponse.json(
                { error: `Database update failed: ${error.message}` },
                { status: 500 }
            );
        }

        console.log(`📎 Pitch deck URL saved for conversation ${conversationId}: ${url}`);

        return NextResponse.json({
            success: true,
            url,
        });
    } catch (error) {
        console.error("❌ Save Pitch Deck API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
