import { NextRequest, NextResponse } from "next/server";
import { extractMeetingNotes } from "@/lib/gemini";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const uploadsDir = path.join(process.cwd(), "uploads", id);
        const transcriptionPath = path.join(uploadsDir, "transcription.json");
        const notesPath = path.join(uploadsDir, "notes.json");

        if (!existsSync(transcriptionPath)) {
            return NextResponse.json(
                { error: "Transcription not found" },
                { status: 404 }
            );
        }

        // Read transcription
        const meetingData = JSON.parse(await readFile(transcriptionPath, "utf-8"));
        const transcriptionText = meetingData.transcription?.text;

        if (!transcriptionText) {
            return NextResponse.json(
                { error: "No transcription text available" },
                { status: 400 }
            );
        }

        // Generate notes
        console.log(`Generating notes for meeting ${id}...`);
        const notes = await extractMeetingNotes(transcriptionText);

        // Save notes
        await writeFile(notesPath, JSON.stringify(notes, null, 2));
        console.log(`Notes saved to ${notesPath}`);

        return NextResponse.json({ success: true, notes });

    } catch (error) {
        console.error("Error generating notes:", error);
        return NextResponse.json(
            { error: "Failed to generate notes" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const notesPath = path.join(process.cwd(), "uploads", id, "notes.json");

        if (!existsSync(notesPath)) {
            return NextResponse.json(
                { error: "Notes not found" },
                { status: 404 }
            );
        }

        const notes = JSON.parse(await readFile(notesPath, "utf-8"));
        return NextResponse.json({ notes });
    } catch (error) {
        console.error("Error fetching notes:", error);
        return NextResponse.json(
            { error: "Failed to fetch notes" },
            { status: 500 }
        );
    }
}
