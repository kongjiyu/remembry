import { NextRequest, NextResponse } from 'next/server';
import { initialize, deleteRagStore, listAllProjects } from '@/lib/fileSearch';

// Initialize AI on module load
initialize();

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const params = await context.params;
        const projectName = params.projectId; // Note: URL param is still projectId for backwards compatibility

        if (!projectName) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // The projectName IS the RAG store name (resource name)
        // No need to call getProjectRagStore -just delete directly
        await deleteRagStore(projectName);

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
