import { NextRequest, NextResponse } from 'next/server';
import { initialize, uploadToRagStore } from '@/lib/fileSearch';
import { transcribeAudio, extractMeetingNotes, TranscriptionResult } from '@/lib/gemini';
import { resolveGeminiApiKeyForRequest } from '@/lib/userKey';
import { upsertMeeting, MeetingNotes } from '@/lib/meetingStorage';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

initialize();

export async function POST(request: NextRequest) {
    let tempDir: string | null = null;

    try {
        const apiKey = await resolveGeminiApiKeyForRequest(request);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not found. Please add your API key in Settings.' },
                { status: 400 }
            );
        }

        const formData = await request.formData();

        const file = formData.get('file') as File;
        const title = formData.get('title') as string;
        const notes = formData.get('notes') as string;
        const projectName = formData.get('projectName') as string;
        const displayName = formData.get('displayName') as string;
        const fileType = formData.get('fileType') as string;
        const notesLanguagesRaw = formData.get('notesLanguages') as string;
        const notesLanguages: string[] = notesLanguagesRaw ? JSON.parse(notesLanguagesRaw) : ['en'];

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Note: For very large files, processing time increases significantly.
        // Gemini API has internal timeout limits; very long recordings may fail.

        if (!projectName) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        const meetingId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileExtension = path.extname(file.name) || (fileType === 'text' ? '.txt' : '.webm');
        const fileName = `${meetingId}${fileExtension}`;

        tempDir = await mkdtemp(path.join(os.tmpdir(), 'remembry-upload-'));

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const sourcePath = path.join(tempDir, `source${fileExtension}`);
        await writeFile(sourcePath, buffer);

        let transcription: TranscriptionResult;
        const notesByLanguage: Record<string, MeetingNotes> = {};
        let transcriptText = '';

        if (fileType === 'text') {
            transcriptText = buffer.toString('utf-8');

            transcription = {
                text: transcriptText,
                segments: [
                    {
                        startTime: 0,
                        endTime: 0,
                        text: transcriptText,
                        speaker: 'Unknown',
                    },
                ],
                speakers: ['Unknown'],
                duration: 0,
                language: 'en',
            };

            const generatedNotes = await extractMeetingNotes(transcriptText, notes || undefined, 'en', apiKey);
            notesByLanguage.en = generatedNotes;
        } else {
            let mimeType = file.type || 'audio/webm';
            if (mimeType === 'video/webm') {
                mimeType = 'audio/webm';
            } else if (mimeType === 'video/mp4') {
                mimeType = 'audio/mp4';
            }

            transcription = await transcribeAudio(sourcePath, mimeType, notes || undefined, apiKey);
            transcriptText = transcription.text;

            for (const lang of notesLanguages) {
                notesByLanguage[lang] = await extractMeetingNotes(transcriptText, notes || undefined, lang, apiKey);
            }
        }

        if (!notesByLanguage.en) {
            notesByLanguage.en = await extractMeetingNotes(transcriptText, notes || undefined, 'en', apiKey);
        }

        const transcriptPath = path.join(tempDir, 'transcript.txt');
        const transcriptContent = `Title: ${title || file.name}\nDate: ${new Date().toISOString()}\n\n${transcriptText}`;
        await writeFile(transcriptPath, transcriptContent);

        await upsertMeeting({
            id: meetingId,
            project_id: projectName,
            title: title || file.name,
            context: notes || '',
            file_name: fileName,
            file_size: file.size,
            mime_type: file.type,
            file_type: fileType || (file.type === 'text/plain' ? 'text' : 'audio'),
            created_at: new Date().toISOString(),
            transcription,
            notes_by_language: notesByLanguage,
            default_language: notesLanguages[0] || 'en',
            available_languages: Array.from(new Set(Object.keys(notesByLanguage))),
        });

        const customMetadata = [
            ...(displayName ? [{ key: 'displayName', stringValue: displayName }] : []),
            { key: 'projectName', stringValue: projectName },
            { key: 'meetingId', stringValue: meetingId },
            { key: 'title', stringValue: title || file.name },
            { key: 'date', stringValue: new Date().toISOString() },
        ];

        let ragUploadStatus = 'skipped';
        try {
            await uploadToRagStore(projectName, transcriptPath, 'text/plain', `${title || file.name} - Transcript`, customMetadata);
            ragUploadStatus = 'success';
        } catch (error) {
            console.error('Failed to upload transcript document:', error);
            ragUploadStatus = 'failed';
        }

        return NextResponse.json({
            success: true,
            meetingId,
            meeting: {
                id: meetingId,
                fileName,
                fileSize: file.size,
                mimeType: file.type,
                fileType: fileType || (file.type === 'text/plain' ? 'text' : 'audio'),
                title: title || file.name,
                notes: notes || '',
                projectName,
                displayName,
                ragUploadStatus,
                uploadedAt: new Date().toISOString(),
                transcription,
                generatedNotes: notesByLanguage[notesLanguages[0] || 'en'] || notesByLanguage.en,
            },
            message: fileType === 'text' ? 'Text transcript uploaded successfully' : 'Meeting uploaded and processed successfully',
        });
    } catch (error) {
        console.error('Error uploading meeting:', error);

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
                errorMessage = `Failed to upload meeting: ${error.message}`;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status: statusCode });
    } finally {
        if (tempDir) {
            try {
                await rm(tempDir, { recursive: true, force: true });
            } catch {
                // ignore cleanup errors
            }
        }
    }
}
