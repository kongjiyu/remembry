import { NextRequest, NextResponse } from "next/server";
import { extractMeetingNotes } from "@/lib/gemini";
import { resolveGeminiApiKeyForRequest } from "@/lib/userKey";
import { getMeetingById, updateMeetingNotesLanguage } from "@/lib/meetingStorage";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const apiKey = await resolveGeminiApiKeyForRequest(request);
        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key not found. Please add your API key in Settings." },
                { status: 400 }
            );
        }

        const { id } = await context.params;
        const meeting = await getMeetingById(decodeURIComponent(id));

        if (!meeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const transcriptionText = meeting.transcription?.text;
        if (!transcriptionText) {
            return NextResponse.json({ error: "No transcription text available" }, { status: 400 });
        }

        const notes = await extractMeetingNotes(transcriptionText, meeting.context || undefined, "en", apiKey);
        await updateMeetingNotesLanguage(meeting.id, "en", notes);

        return NextResponse.json({ success: true, notes });
    } catch (error) {
        console.error("Error generating notes:", error);
        return NextResponse.json({ error: "Failed to generate notes" }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const meeting = await getMeetingById(decodeURIComponent(id));

        if (!meeting) {
            return NextResponse.json({ error: "Notes not found" }, { status: 404 });
        }

        const notes = meeting.notes_by_language?.[meeting.default_language || "en"] || null;
        if (!notes) {
            return NextResponse.json({ error: "Notes not found" }, { status: 404 });
        }

        return NextResponse.json({ notes });
    } catch (error) {
        console.error("Error fetching notes:", error);
        return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }
}
