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
        const projectId = params.projectId;

        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // Check if ragStoreName is provided in the request body (more efficient)
        let ragStoreName: string | undefined;
        try {
            const body = await request.json();
            ragStoreName = body.ragStoreName;
        } catch {
            // No body provided, will look up from projects list
        }

        if (!ragStoreName) {
            // Find the project to get its actual ragStoreName
            const projects = await listAllProjects();
            const project = projects.find(p => p.id === projectId);
            
            if (!project) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }
            ragStoreName = project.ragStoreName;
        }

        // Delete the RAG store using the actual store name
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
