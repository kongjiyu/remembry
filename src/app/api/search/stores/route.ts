import { NextRequest, NextResponse } from "next/server";
import { listAllProjects, initialize } from "@/lib/fileSearch";

// Initialize AI on module load
initialize();

/**
 * List available RAG stores endpoint
 * Returns all available RAG stores with actual project names from metadata
 */
export async function GET(request: NextRequest) {
    try {
        const projects = await listAllProjects();
        
        // Transform projects to store format with actual project names
        const stores = projects.map(project => ({
            name: project.ragStoreName,
            displayName: project.name, // User-entered project name from metadata
            createTime: project.createdAt
        }));

        return NextResponse.json({
            stores: stores,
            total: stores.length
        });
    } catch (error) {
        console.error("Failed to list RAG stores:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Failed to list RAG stores: ${errorMessage}` },
            { status: 500 }
        );
    }
}
