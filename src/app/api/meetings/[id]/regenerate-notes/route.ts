import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { extractMeetingNotes, SUPPORTED_LANGUAGES } from "@/lib/gemini";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { language } = await request.json();

        // Validate language
        if (!language || !SUPPORTED_LANGUAGES.some(l => l.code === language)) {
            return NextResponse.json(
                { error: "Invalid language code" },
                { status: 400 }
            );
        }

        // Decode URL-encoded ID
        const decodedId = decodeURIComponent(id);
        const transcriptionPath = path.join(process.cwd(), "uploads", decodedId, "transcription.json");
        
        if (!existsSync(transcriptionPath)) {
            return NextResponse.json(
                { error: "Meeting not found" },
                { status: 404 }
            );
        }

        // Read existing transcription
        const transcriptionData = await readFile(transcriptionPath, "utf-8");
        const meeting = JSON.parse(transcriptionData);
        const transcriptionText = meeting.transcription?.text;

        if (!transcriptionText) {
            return NextResponse.json(
                { error: "No transcription text found" },
                { status: 400 }
            );
        }

        console.log(`[regenerate-notes] Regenerating notes for meeting ${decodedId} in language: ${language}`);

        // Extract meeting notes in the new language
        const notes = await extractMeetingNotes(transcriptionText, undefined, language);

        // Save language-specific notes
        const uploadsDir = path.join(process.cwd(), "uploads", decodedId);
        const langNotesPath = path.join(uploadsDir, `notes-${language}.json`);
        await writeFile(langNotesPath, JSON.stringify(notes, null, 2));

        // If this is the default English, also save as notes.json for backwards compatibility
        if (language === 'en') {
            const defaultNotesPath = path.join(uploadsDir, "notes.json");
            await writeFile(defaultNotesPath, JSON.stringify(notes, null, 2));
        }

        // Update metadata to include this language
        const metadataPath = path.join(uploadsDir, "metadata.json");
        let metadata: { availableLanguages: string[]; defaultLanguage: string; createdAt: string } = {
            availableLanguages: [],
            defaultLanguage: 'en',
            createdAt: new Date().toISOString()
        };
        
        if (existsSync(metadataPath)) {
            const metadataData = await readFile(metadataPath, "utf-8");
            metadata = JSON.parse(metadataData);
        }
        
        if (!metadata.availableLanguages.includes(language)) {
            metadata.availableLanguages.push(language);
            await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        }

        console.log(`[regenerate-notes] ✓ Notes regenerated and saved for language: ${language}`);

        return NextResponse.json({ 
            success: true, 
            notes,
            language 
        });

    } catch (error) {
        console.error("[regenerate-notes] Error:", error);
        return NextResponse.json(
            { error: "Failed to regenerate notes" },
            { status: 500 }
        );
    }
}

// GET to fetch notes in a specific language
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const language = searchParams.get('language') || 'en';

        // Decode URL-encoded ID
        const decodedId = decodeURIComponent(id);
        
        // Try language-specific notes first
        const langNotesPath = path.join(process.cwd(), "uploads", decodedId, `notes-${language}.json`);
        const defaultNotesPath = path.join(process.cwd(), "uploads", decodedId, "notes.json");

        let notesPath = langNotesPath;
        let needsRegeneration = false;

        if (!existsSync(langNotesPath)) {
            if (language === 'en' && existsSync(defaultNotesPath)) {
                notesPath = defaultNotesPath;
            } else {
                needsRegeneration = true;
            }
        }

        if (needsRegeneration) {
            return NextResponse.json({
                notes: null,
                language,
                needsRegeneration: true
            });
        }

        const notesData = await readFile(notesPath, "utf-8");
        const notes = JSON.parse(notesData);

        return NextResponse.json({
            notes,
            language,
            needsRegeneration: false
        });

    } catch (error) {
        console.error("[get-notes] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch notes" },
            { status: 500 }
        );
    }
}
