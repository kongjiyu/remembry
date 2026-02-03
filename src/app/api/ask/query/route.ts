import { NextRequest, NextResponse } from "next/server";
import { fileSearch, getProjectRagStore, initialize } from "@/lib/fileSearch";

// Initialize AI on module load
initialize();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, question } = body;

        console.log("Ask query received:", { projectId, questionLength: question?.length });

        if (!projectId || !question) {
            return NextResponse.json(
                { error: "Missing required parameters: projectId and question are required" },
                { status: 400 }
            );
        }

        // Get the project-specific RAG store
        // Each project has its own isolated RAG store, so no filtering needed
        const ragStoreName = await getProjectRagStore(projectId);
        
        // Simplified query - no need for project filtering since each project has its own store
        const searchQuery = `User Question: ${question}\n\nProvide a detailed answer based on the uploaded documents. Include specific references to document names or sections when possible. If the information is not available, clearly state that.`;
        
        console.log("Querying project RAG store:", { ragStoreName, projectId });
        
        const result = await fileSearch(ragStoreName, searchQuery);

        console.log("RAG query result:", { textLength: result.text?.length, groundingChunkCount: result.groundingChunks?.length });

        // Log all chunk titles/names for debugging
        result.groundingChunks?.forEach((chunk, idx) => {
            console.log(`Chunk ${idx}:`, {
                title: chunk.retrievedContext?.title,
                documentName: chunk.retrievedContext?.documentName,
                textPreview: chunk.retrievedContext?.text?.substring(0, 100)
            });
        });

        // Extract grounding chunks for sources
        // No need for complex filtering since all documents in this store belong to this project
        const groundingChunks = result.groundingChunks
            ?.filter(chunk => {
                const text = chunk.retrievedContext?.text || '';
                const documentName = chunk.retrievedContext?.documentName || '';
                const title = chunk.retrievedContext?.title || '';
                
                // Filter out empty chunks
                if (!text || text.trim().length === 0) {
                    return false;
                }
                
                // Filter out the project metadata document
                if (documentName === '.project-metadata.json' || title === '.project-metadata.json') {
                    console.log("Filtered out project metadata document");
                    return false;
                }
                
                return true;
            })
            .map(chunk => ({
                retrievedContext: {
                    text: chunk.retrievedContext?.text,
                    documentName: chunk.retrievedContext?.documentName,
                    title: chunk.retrievedContext?.title
                }
            })) || [];

        console.log("Filtered grounding chunks:", groundingChunks.length);

        return NextResponse.json({
            answer: result.text || "I couldn't find relevant information to answer your question.",
            groundingChunks: groundingChunks
        });
    } catch (error) {
        console.error("Failed to answer question:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Failed to answer question: ${errorMessage}` },
            { status: 500 }
        );
    }
}
