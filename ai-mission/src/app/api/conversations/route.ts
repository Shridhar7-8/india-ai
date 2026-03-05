import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { getInitialChecklist, getInitialSummary } from "@/agents/conductor";
import { GREETING_MESSAGE } from "@/agents/prompts";
import { ConversationCreateSchema } from "@/lib/schemas";

/**
 * GET /api/conversations — List all conversations for the authenticated user.
 */
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        const activeUserId = (process.env.NODE_ENV === "development" && req.headers.get("x-e2e-userid")) || userId;

        if (!activeUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data, error } = await supabase
            .from("conversations")
            .select("id, clerk_user_id, title, status, created_at, updated_at")
            .eq("clerk_user_id", activeUserId)
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Error fetching conversations:", error);
            return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error("❌ Conversations GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/conversations — Create a new conversation with greeting.
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        const activeUserId = (process.env.NODE_ENV === "development" && req.headers.get("x-e2e-userid")) || userId;

        if (!activeUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const parsed = ConversationCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }
        const { title } = parsed.data;

        // Create conversation
        const { data: conversation, error: convError } = await supabase
            .from("conversations")
            .insert({ clerk_user_id: activeUserId, title })
            .select()
            .single();

        if (convError || !conversation) {
            console.error("Error creating conversation:", convError);
            return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
        }

        // Create interview state
        await supabase.from("interview_states").insert({
            conversation_id: conversation.id,
            checklist: getInitialChecklist(),
            conversation_summary: getInitialSummary(),
        });

        return NextResponse.json(conversation, { status: 201 });
    } catch (error) {
        console.error("❌ Conversations POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
