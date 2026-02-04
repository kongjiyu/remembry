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

        // Validate file size (Gemini API limit is ~100MB)
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { 
                    error: `File size exceeds the maximum allowed size of 100MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
                    fileSize: file.size,
                    maxSize: MAX_FILE_SIZE
                },
                { status: 413 }
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
        let transcriptPath: string | null = null;

        if (fileType !== 'text') {
            console.log(`Transcribing file: ${fileName}, size: ${file.size}, type: ${file.type}`);
            
            // Transcribe
            transcription = await transcribeAudio(
                audioPath,
                file.type || "audio/webm",
                notes || undefined
            );

            // Save transcription result as JSON
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

            // Save transcript as plain text for RAG upload
            transcriptPath = path.join(uploadsDir, "transcript.txt");
            const transcriptContent = `Title: ${title || file.name}\nDate: ${new Date().toISOString()}\nParticipants: ${participants || 'N/A'}\n\n${transcription.text}`;
            await writeFile(transcriptPath, transcriptContent);

            // Extract Notes
            generatedNotes = await extractMeetingNotes(transcription.text, notes || undefined);
            const notesPath = path.join(uploadsDir, "notes.json");
            await writeFile(notesPath, JSON.stringify(generatedNotes, null, 2));
        }

        // --- Feature: RAG Store Upload ---
        // Upload transcript to RAG (not audio file)
        let ragUploadStatus = 'skipped';
        if (transcriptPath) {
            const customMetadata = [
                ...(projectName ? [{ key: 'projectName', stringValue: projectName }] : []),
                { key: 'meetingId', stringValue: meetingId },
                { key: 'title', stringValue: title || file.name },
                { key: 'date', stringValue: new Date().toISOString() }
            ];

            try {
                await uploadToRagStore(
                    ragStoreName,
                    transcriptPath,
                    'text/plain',
                    `${title || file.name} - Transcript`,
                    customMetadata
                );
                ragUploadStatus = 'success';
                console.log('Successfully uploaded transcript to RAG store');
            } catch (error) {
                console.error('Failed to upload transcript to RAG store:', error);
                ragUploadStatus = 'failed';
                // Continue even if RAG upload fails, as we have local storage
            }
        }

        // Return success with meeting metadata
        const meeting = {
            id: meetingId,
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
            ragUploadStatus,
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
        
        // Provide more specific error messages
        let errorMessage = 'Failed to upload meeting';
        let statusCode = 500;
        
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            
            if (msg.includes('fetch failed') || msg.includes('network')) {
                errorMessage = 'Network error: Unable to connect to Gemini API. Please check your internet connection and try again.';
                statusCode = 503;
            } else if (msg.includes('api key') || msg.includes('unauthorized')) {
                errorMessage = 'API authentication error. Please check your API key configuration.';
                statusCode = 401;
            } else if (msg.includes('rate limit') || msg.includes('quota')) {
                errorMessage = 'API rate limit exceeded. Please try again later.';
                statusCode = 429;
            } else if (msg.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again with a smaller file.';
                statusCode = 504;
            } else {
                // Include the actual error message for debugging
                errorMessage = `Failed to upload meeting: ${error.message}`;
            }
        }
        
        return NextResponse.json(
            { error: errorMessage },
            { status: statusCode }
        );
    }
}

