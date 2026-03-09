import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { z } from "zod";

const FeedbackBodySchema = z.object({
    conversationId: z.coerce.number(),
    rating: z.number().min(1).max(5),
    reflectionScore: z.number().min(1).max(5),
    difficulties: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const json = await req.json();
        const parsed = FeedbackBodySchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid feedback payload", details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { conversationId, rating, reflectionScore, difficulties } = parsed.data;

        const supabase = getSupabase();

        // Check if the conversation actually exists
        const { data: conv, error: convError } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", conversationId)
            .single();

        if (convError || !conv) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        // Insert feedback into the new table
        const { error: insertError } = await supabase
            .from("feedbacks")
            .insert({
                conversation_id: conversationId,
                rating,
                reflection_score: reflectionScore,
                difficulties,
            });

        if (insertError) {
            console.error("Error inserting feedback:", insertError);
            return NextResponse.json(
                { error: "Failed to save feedback" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error in /api/feedback:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
