import { NextRequest, NextResponse } from "next/server";
import { generateExampleQuestions, initialize, getProjectRagStore } from "@/lib/fileSearch";

// Initialize AI on module load
initialize();

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json(
                { error: "Missing projectId parameter" },
                { status: 400 }
            );
        }

        // Get project-specific RAG store
        const ragStoreName = await getProjectRagStore(projectId);
        
        // Generate example questions for the project
        // No need to pass contextId since all documents in this store belong to this project
        const questions = await generateExampleQuestions(ragStoreName, "project", projectId);

        return NextResponse.json({ questions });
    } catch (error) {
        console.error("Failed to generate example questions:", error);
        return NextResponse.json(
            { error: "Failed to generate example questions" },
            { status: 500 }
        );
    }
}
