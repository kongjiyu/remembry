import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const supabase = getSupabaseServerClient();

        const { data, error } = await supabase
            .from("meetings")
            .select("id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages")
            .eq("id", decodeURIComponent(id))
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return NextResponse.json(
                { error: "Meeting not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ meeting: data });
    } catch (error) {
        console.error("Error fetching meeting:", error);
        return NextResponse.json(
            { error: "Failed to fetch meeting" },
            { status: 500 }
        );
    }
}