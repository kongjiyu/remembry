import { NextRequest, NextResponse } from "next/server";
import { generateExampleQuestions, initialize, getProjectRagStore } from "@/lib/fileSearch";

// Initialize AI on module load
initialize();

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const projectName = searchParams.get("projectName");

        if (!projectName) {
            return NextResponse.json(
                { error: "Missing projectName parameter" },
                { status: 400 }
            );
        }

        // Use projectName directly as the RAG store name
        const ragStoreName = projectName;
        
        // Generate example questions for the project
        const questions = await generateExampleQuestions(ragStoreName, "project", projectName);

        return NextResponse.json({ questions });
    } catch (error) {
        console.error("Failed to generate example questions:", error);
        return NextResponse.json(
            { error: "Failed to generate example questions" },
            { status: 500 }
        );
    }
}
