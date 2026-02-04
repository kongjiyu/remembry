import { NextRequest, NextResponse } from 'next/server';
import { initialize, uploadToRagStore } from '@/lib/fileSearch';
import { transcribeAudio, extractMeetingNotes, TranscriptionResult } from '@/lib/gemini';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Initialize AI on module load
initialize();

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        
        const file = formData.get('file') as File;
        const ragStoreName = formData.get('ragStoreName') as string;
        const title = formData.get('title') as string;
        const participants = formData.get('participants') as string;
        const notes = formData.get('notes') as string;
        const projectId = formData.get('projectId') as string;
        const projectName = formData.get('projectName') as string;
        const fileType = formData.get('fileType') as string;
        const duration = formData.get('duration') as string;

        // Validate required fields
        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        if (!ragStoreName) {
            return NextResponse.json(
                { error: 'RAG store name is required' },
                { status: 400 }
            );
        }

        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // Generate a unique meeting ID
        const meetingId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileExtension = path.extname(file.name) || (fileType === 'text' ? '.txt' : '.webm');
        const fileName = `${meetingId}${fileExtension}`;

        // Save locally first (needed for Gemini Transcription API)
        const uploadsDir = path.join(process.cwd(), "uploads", meetingId);
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const audioPath = path.join(uploadsDir, `audio${fileExtension}`);
        await writeFile(audioPath, buffer);

        // --- Feature: Automated Transcription & Notes Extraction ---
        // Only run transcription for audio files
        let transcription: TranscriptionResult | null = null;
        let generatedNotes = null;

        if (fileType !== 'text') {
            console.log(`Transcribing file: ${fileName}, size: ${file.size}, type: ${file.type}`);
            
            // Transcribe
            transcription = await transcribeAudio(
                audioPath,
                file.type || "audio/webm",
                notes || undefined
            );

            // Save transcription result
            const transcriptionPath = path.join(uploadsDir, "transcription.json");
            const meetingData = {
                id: meetingId,
                title: title || file.name,
                context: notes || "",
                createdAt: new Date().toISOString(),
                status: "completed",
                transcription,
                audioPath: `uploads/${meetingId}/audio${fileExtension}`,
            };
            await writeFile(transcriptionPath, JSON.stringify(meetingData, null, 2));

            // Extract Notes
            generatedNotes = await extractMeetingNotes(transcription.text, notes || undefined);
            const notesPath = path.join(uploadsDir, "notes.json");
            await writeFile(notesPath, JSON.stringify(generatedNotes, null, 2));
        }

        // --- Feature: RAG Store Upload (Main Branch Feature) ---
        // Custom metadata for document
        const customMetadata = [
            ...(projectName ? [{ key: 'projectName', stringValue: projectName }] : []),
            { key: 'meetingId', stringValue: meetingId }, // Link RAG doc to local storage
            { key: 'notes', stringValue: notes || '' }
        ];

        // Upload to project-specific RAG store
        try {
            await uploadToRagStore(
                ragStoreName, 
                audioPath, 
                file.type || (fileType === 'text' ? 'text/plain' : 'audio/webm'),
                fileName,
                customMetadata
            );
        } catch (error) {
            console.error('Failed to upload to RAG store:', error);
            // We continue even if RAG upload fails, as we have local storage
        }

        // Return success with meeting metadata
        const meeting = {
            id: meetingId, // Return the ID for redirection
            fileName: fileName,
            fileSize: file.size,
            mimeType: file.type,
            fileType: fileType || (file.type === 'text/plain' ? 'text' : 'audio'),
            title: title || file.name,
            participants: participants || '',
            notes: notes || '',
            projectId,
            projectName,
            ragStoreName,
            uploadedAt: new Date().toISOString(),
            transcription: transcription,
            generatedNotes: generatedNotes
        };

        return NextResponse.json({
            success: true,
            meetingId, // Explicitly return for frontend
            meeting,
            message: fileType === 'text' 
                ? 'Text transcript uploaded successfully' 
                : 'Meeting uploaded and processed successfully',
        });
    } catch (error) {
        console.error('Error uploading meeting:', error);
        return NextResponse.json(
            { error: 'Failed to upload meeting' },
            { status: 500 }
        );
    }
}

