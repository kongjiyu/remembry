import { NextRequest, NextResponse } from "next/server";
import { extractMeetingNotes, SUPPORTED_LANGUAGES } from "@/lib/gemini";
import { resolveGeminiApiKeyForRequest } from "@/lib/userKey";
import { getMeetingById, getMeetingNotes, updateMeetingNotesLanguage } from "@/lib/meetingStorage";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const apiKey = await resolveGeminiApiKeyForRequest(request);
        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key not found. Please add your API key in Settings." },
                { status: 400 }
            );
        }

        const { id } = await params;
        const { language } = await request.json();

        if (!language || !SUPPORTED_LANGUAGES.some((l) => l.code === language)) {
            return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
        }

        const meeting = await getMeetingById(decodeURIComponent(id));
        if (!meeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const transcriptionText = meeting.transcription?.text;
        if (!transcriptionText) {
            return NextResponse.json({ error: "No transcription text found" }, { status: 400 });
        }

        const notes = await extractMeetingNotes(transcriptionText, meeting.context || undefined, language, apiKey);
        await updateMeetingNotesLanguage(meeting.id, language, notes);

        return NextResponse.json({ success: true, notes, language });
    } catch (error) {
        console.error("[regenerate-notes] Error:", error);
        return NextResponse.json({ error: "Failed to regenerate notes" }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const language = searchParams.get("language") || "en";

        const meeting = await getMeetingById(decodeURIComponent(id));
        if (!meeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const { notes, needsRegeneration } = await getMeetingNotes(meeting.id, language);

        return NextResponse.json({ notes, language, needsRegeneration });
    } catch (error) {
        console.error("[get-notes] Error:", error);
        return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }
}
