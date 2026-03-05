import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]/messages — Fetch all messages for a conversation.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const conversationId = parseInt(id, 10);

        // Verify ownership
        const { data: conversation } = await supabase
            .from("conversations")
            .select("clerk_user_id")
            .eq("id", conversationId)
            .single();

        if (!conversation || conversation.clerk_user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const { data: messages, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
        }

        return NextResponse.json(messages || []);
    } catch (error) {
        console.error("❌ Messages GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
