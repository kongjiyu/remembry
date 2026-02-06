import { NextRequest, NextResponse } from 'next/server';
import { initialize, uploadToRagStore, getProjectRagStore } from '@/lib/fileSearch';
import { transcribeAudio, extractMeetingNotes, TranscriptionResult } from '@/lib/gemini';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Initialize AI on module load
initialize();

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        
        const file = formData.get('file') as File;
        const title = formData.get('title') as string;
        const notes = formData.get('notes') as string;
        const projectName = formData.get('projectName') as string; // RAG store resource name
        const displayName = formData.get('displayName') as string; // User-entered project name
        const fileType = formData.get('fileType') as string;
        const duration = formData.get('duration') as string;
        const notesLanguagesRaw = formData.get('notesLanguages') as string;
        const notesLanguages: string[] = notesLanguagesRaw ? JSON.parse(notesLanguagesRaw) : ['en'];

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

        if (!projectName) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // Use projectName directly as the RAG store name (it already is the resource name)
        const actualRagStoreName = projectName;
        console.log(`[UPLOAD] Using RAG store: ${actualRagStoreName}`);

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
        const filePath = path.join(uploadsDir, `audio${fileExtension}`);
        await writeFile(filePath, buffer);

        // --- Feature: Automated Transcription & Notes Extraction ---
        let transcription: TranscriptionResult | null = null;
        let generatedNotes = null;
        let transcriptPath: string | null = null;
        let textContent = '';

        console.log(`[UPLOAD] File type: ${fileType}, Processing file: ${fileName}`);

        if (fileType === 'text') {
            // Handle text file upload
            console.log(`[TEXT] Processing text file: ${fileName}`);
            
            // Read the text content
            textContent = buffer.toString('utf-8');
            console.log(`[TEXT] Read ${textContent.length} characters from text file`);
            
            // Save as transcript for RAG upload
            transcriptPath = path.join(uploadsDir, "transcript.txt");
            console.log(`[TEXT] Transcript path: ${transcriptPath}`);
            const transcriptContent = `Title: ${title || file.name}\nDate: ${new Date().toISOString()}\n\n${textContent}`;
            await writeFile(transcriptPath, transcriptContent);
            
            // Create a basic transcription structure for consistency
            transcription = {
                text: textContent,
                segments: [{
                    startTime: 0,
                    endTime: 0,
                    text: textContent,
                    speaker: "Unknown"
                }],
                speakers: ["Unknown"],
                duration: 0,
                language: "en"
            };
            
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
            console.log(`[TEXT] Saved transcription.json`);
            
            // Extract Notes from text content
            console.log(`[TEXT] Extracting meeting notes...`);
            generatedNotes = await extractMeetingNotes(textContent, notes || undefined);
            const notesPath = path.join(uploadsDir, "notes.json");
            await writeFile(notesPath, JSON.stringify(generatedNotes, null, 2));
            console.log(`[TEXT] Saved notes.json`);
            
        } else {
            // Handle audio file upload
            console.log(`[AUDIO] Transcribing file: ${fileName}, size: ${file.size}, type: ${file.type}`);
            
            // Normalize MIME type for Gemini API
            // WebM files may be reported as video/webm by browsers, but Gemini accepts audio/webm
            let mimeType = file.type || "audio/webm";
            if (mimeType === "video/webm") {
                mimeType = "audio/webm";
            } else if (mimeType === "video/mp4") {
                mimeType = "audio/mp4";
            }
            
            // Transcribe
            transcription = await transcribeAudio(
                filePath,
                mimeType,
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
            const transcriptContent = `Title: ${title || file.name}\nDate: ${new Date().toISOString()}\n\n${transcription.text}`;
            await writeFile(transcriptPath, transcriptContent);

            // Extract Notes in each requested language
            const generatedNotesMap: Record<string, any> = {};
            for (const lang of notesLanguages) {
                console.log(`Generating notes in language: ${lang}`);
                const langNotes = await extractMeetingNotes(transcription.text, notes || undefined, lang);
                generatedNotesMap[lang] = langNotes;
                
                // Save language-specific notes
                const langNotesPath = path.join(uploadsDir, `notes-${lang}.json`);
                await writeFile(langNotesPath, JSON.stringify(langNotes, null, 2));
            }
            
            // Save the first language as default notes.json for backwards compatibility
            generatedNotes = generatedNotesMap[notesLanguages[0]];
            const notesPath = path.join(uploadsDir, `notes.json`);
            await writeFile(notesPath, JSON.stringify(generatedNotes, null, 2));
            
            // Save metadata about available languages
            const metadataPath = path.join(uploadsDir, "metadata.json");
            await writeFile(metadataPath, JSON.stringify({
                availableLanguages: notesLanguages,
                defaultLanguage: notesLanguages[0],
                createdAt: new Date().toISOString()
            }, null, 2));
        }

        // --- Feature: RAG Store Upload ---
        // Upload transcript to RAG (not audio file)
        console.log(`[RAG] Checking if transcript should be uploaded...`);
        console.log(`[RAG] transcriptPath = ${transcriptPath}`);
        console.log(`[RAG] actualRagStoreName = ${actualRagStoreName}`);
        
        let ragUploadStatus = 'skipped';
        if (transcriptPath) {
            console.log(`[RAG] Starting RAG upload process...`);
            const customMetadata = [
                ...(displayName ? [{ key: 'displayName', stringValue: displayName }] : []),
                { key: 'projectName', stringValue: projectName },
                { key: 'meetingId', stringValue: meetingId },
                { key: 'title', stringValue: title || file.name },
                { key: 'date', stringValue: new Date().toISOString() }
            ];
            
            console.log(`[RAG] Metadata prepared:`, customMetadata);

            try {
                console.log(`[RAG] Calling uploadToRagStore...`);
                await uploadToRagStore(
                    actualRagStoreName,
                    transcriptPath,
                    'text/plain',
                    `${title || file.name} - Transcript`,
                    customMetadata
                );
                ragUploadStatus = 'success';
                console.log(`✓ Successfully uploaded transcript to RAG store: ${actualRagStoreName}`);
                console.log(`  Meeting ID: ${meetingId}, Title: ${title || file.name}`);
            } catch (error) {
                console.error('✗ Failed to upload transcript to RAG store:', error);
                ragUploadStatus = 'failed';
                // Continue even if RAG upload fails, as we have local storage
            }
        } else {
            console.log(`[RAG] Skipped - transcriptPath is null/undefined`);
        }

        // Return success with meeting metadata
        const meeting = {
            id: meetingId,
            fileName: fileName,
            fileSize: file.size,
            mimeType: file.type,
            fileType: fileType || (file.type === 'text/plain' ? 'text' : 'audio'),
            title: title || file.name,
            notes: notes || '',
            projectName,
            displayName,
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

