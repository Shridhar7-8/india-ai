import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { ConversationUpdateSchema } from "@/lib/schemas";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id] — Get conversation details with messages.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const conversationId = parseInt(id, 10);

        // Fetch conversation
        const { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .eq("clerk_user_id", userId)
            .single();

        if (!conversation) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Fetch messages (exclude system messages like reports)
        const { data: messages } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .neq("role", "system")
            .order("created_at", { ascending: true });

        // Fetch interview state
        const { data: interviewState } = await supabase
            .from("interview_states")
            .select("*")
            .eq("conversation_id", conversationId)
            .single();

        return NextResponse.json({
            ...conversation,
            messages: messages || [],
            interviewState,
        });
    } catch (error) {
        console.error("❌ Conversation GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/conversations/[id] — Update conversation title.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const conversationId = parseInt(id, 10);

        const body = await req.json();
        const parsed = ConversationUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        // Verify ownership
        const { data: existing } = await supabase
            .from("conversations")
            .select("clerk_user_id")
            .eq("id", conversationId)
            .single();

        if (!existing || existing.clerk_user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const { data, error } = await supabase
            .from("conversations")
            .update({ title: parsed.data.title })
            .eq("id", conversationId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: "Failed to update" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("❌ Conversation PATCH error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/conversations/[id] — Delete a conversation.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const conversationId = parseInt(id, 10);

        // Verify ownership
        const { data: existing } = await supabase
            .from("conversations")
            .select("clerk_user_id")
            .eq("id", conversationId)
            .single();

        if (!existing || existing.clerk_user_id !== userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await supabase.from("conversations").delete().eq("id", conversationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("❌ Conversation DELETE error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
