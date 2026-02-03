import { NextRequest, NextResponse } from 'next/server';
import { initialize, uploadToRagStore } from '@/lib/fileSearch';

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

        // Custom metadata for document (optional - can include meeting metadata)
        const customMetadata = projectName ? [
            {
                key: 'projectName',
                stringValue: projectName,
            },
        ] : undefined;

        // Upload to project-specific RAG store
        // No need for project ID in metadata since each project has its own store
        try {
            await uploadToRagStore(ragStoreName, file, customMetadata);
        } catch (error) {
            console.error('Failed to upload to RAG store:', error);
            return NextResponse.json(
                { error: 'Failed to upload meeting to RAG store' },
                { status: 500 }
            );
        }

        // Return success with meeting metadata
        // Always use file name as the display name
        const meeting = {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileType: fileType || (file.type === 'text/plain' ? 'text' : 'audio'),
            title: file.name, // Always use file name as display name
            participants: participants || '',
            notes: notes || '',
            projectId,
            projectName,
            ragStoreName,
            uploadedAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            meeting,
            message: fileType === 'text' 
                ? 'Text transcript uploaded successfully to project RAG store' 
                : 'Meeting uploaded successfully to project RAG store',
        });
    } catch (error) {
        console.error('Error uploading meeting:', error);
        return NextResponse.json(
            { error: 'Failed to upload meeting' },
            { status: 500 }
        );
    }
}
