import { NextRequest, NextResponse } from 'next/server';
import { initialize, deleteRagStore, getProjectRagStore } from '@/lib/fileSearch';

// Initialize AI on module load
initialize();

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const params = await context.params;
        const projectId = params.projectId;

        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // Get the project's RAG store name
        const ragStoreName = await getProjectRagStore(projectId);

        // Delete the RAG store
        await deleteRagStore(ragStoreName);

        return NextResponse.json({
            success: true,
            message: 'Project and RAG store deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
