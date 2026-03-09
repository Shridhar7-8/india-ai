import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const { userId } = await auth();
        const e2eUserId = req.headers.get("x-e2e-userid");
        const effectiveUserId = e2eUserId || userId;

        if (!effectiveUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const conversationId = formData.get("conversationId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!conversationId) {
            return NextResponse.json({ error: "No conversationId provided" }, { status: 400 });
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        const ext = fileName.substring(fileName.lastIndexOf("."));
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 400 }
            );
        }

        // Upload to Supabase Storage
        const buffer = Buffer.from(await file.arrayBuffer());
        const storagePath = `${conversationId}/${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from("pitch-decks")
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: true,
            });

        if (uploadError) {
            console.error("❌ Upload error:", uploadError);
            return NextResponse.json(
                { error: `Upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        console.log(`📎 File uploaded: ${storagePath}`);

        return NextResponse.json({
            success: true,
            fileName: file.name,
            storagePath,
        });
    } catch (error) {
        console.error("❌ Upload API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
