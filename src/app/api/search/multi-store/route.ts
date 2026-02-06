import { NextRequest, NextResponse } from "next/server";
import { retrieveChunks, generateResponse, initialize, listAllProjects } from "@/lib/fileSearch";

// Initialize AI on module load
initialize();

/**
 * Multi-RAG-store search endpoint
 * 
 * Architecture:
 * 1. Each store is queried independently in parallel (File Search retrieves chunks ONLY)
 * 2. Retrieved chunks are aggregated and labeled by store
 * 3. ONE final LLM call generates a response with:
 *    - Overall Summary (synthesizing all stores)
 *    - Per-Store Details (isolated sections for each store)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, storeNames, timeout = 30000 } = body;

        console.log("Multi-store search received:", { 
            storeCount: storeNames?.length, 
            queryLength: query?.length,
            timeout 
        });

        // Validation
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return NextResponse.json(
                { error: "Query is required and must be a non-empty string" },
                { status: 400 }
            );
        }

        if (!Array.isArray(storeNames) || storeNames.length === 0) {
            return NextResponse.json(
                { error: "At least one store must be selected" },
                { status: 400 }
            );
        }

        // Validate store names
        const invalidStores = storeNames.filter(name => !name || typeof name !== 'string');
        if (invalidStores.length > 0) {
            return NextResponse.json(
                { error: "All store names must be valid strings" },
                { status: 400 }
            );
        }

        // Fetch project names for display
        const projects = await listAllProjects();
        const storeToProjectName = new Map<string, string>();
        projects.forEach(project => {
            storeToProjectName.set(project.name, project.displayName);
        });

        // Step 1: Parallel retrieval from all stores (chunks only, NO generation)
        console.log(`Starting parallel retrieval from ${storeNames.length} stores`);
        
        const retrievalPromises = storeNames.map(async (storeName) => {
            try {
                const chunks = await Promise.race([
                    retrieveChunks(storeName, query),
                    new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                
                return {
                    storeName,
                    success: true,
                    chunks,
                    error: null
                };
            } catch (error) {
                console.error(`Retrieval failed for store ${storeName}:`, error);
                return {
                    storeName,
                    success: false,
                    chunks: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });

        // Wait for all retrievals to complete (or timeout)
        const retrievalResults = await Promise.all(retrievalPromises);

        // Step 2: Aggregate chunks with store identifiers
        const aggregatedChunks: Array<{
            storeName: string;
            storeDisplayName: string;
            text: string;
            documentName?: string;
            title?: string;
        }> = [];

        const storeStats: Array<{
            storeName: string;
            storeDisplayName: string;
            success: boolean;
            chunkCount: number;
            error?: string;
        }> = [];

        retrievalResults.forEach(({ storeName, success, chunks, error }) => {
            // Use actual project name from metadata
            const displayName = storeToProjectName.get(storeName) || 
                               storeName.split('/').pop()?.replace('Project_', '') || 
                               storeName;
            
            if (success && chunks) {
                const validChunks = chunks.filter(chunk => {
                    const text = chunk.retrievedContext?.text || '';
                    const documentName = chunk.retrievedContext?.documentName || '';
                    
                    // Filter out empty chunks and metadata files
                    return text.trim().length > 0 && 
                           !documentName.includes('.project-metadata') &&
                           !documentName.includes('.metadata');
                });

                validChunks.forEach(chunk => {
                    aggregatedChunks.push({
                        storeName,
                        storeDisplayName: displayName,
                        text: chunk.retrievedContext?.text || '',
                        documentName: chunk.retrievedContext?.documentName,
                        title: chunk.retrievedContext?.title
                    });
                });

                storeStats.push({
                    storeName,
                    storeDisplayName: displayName,
                    success: true,
                    chunkCount: validChunks.length
                });

                console.log(`Store ${displayName}: ${validChunks.length} chunks retrieved`);
            } else {
                storeStats.push({
                    storeName,
                    storeDisplayName: displayName,
                    success: false,
                    chunkCount: 0,
                    error: error || 'Unknown error'
                });

                console.warn(`Store ${displayName}: retrieval failed - ${error}`);
            }
        });

        // Check if we have any evidence
        if (aggregatedChunks.length === 0) {
            const failedStores = storeStats.filter(s => !s.success);
            const allFailed = failedStores.length === storeNames.length;
            
            return NextResponse.json({
                answer: allFailed 
                    ? "Unable to retrieve information from any selected sources. Please try again or select different sources."
                    : "No relevant information found in the selected sources for your query.",
                storeStats,
                aggregatedChunks: [],
                totalChunks: 0
            });
        }

        // Step 3: Build context for synthesis with clear store separation
        const successfulStores = storeStats.filter(s => s.success && s.chunkCount > 0);
        
        // Build per-store context sections
        const perStoreContexts = successfulStores.map(stat => {
            const storeChunks = aggregatedChunks.filter(c => c.storeName === stat.storeName);
            const chunksText = storeChunks
                .map((chunk) => {
                    const docInfo = chunk.documentName || chunk.title || 'Unknown document';
                    return `[Document: ${docInfo}]\n${chunk.text}`;
                })
                .join('\n\n');
            
            return {
                displayName: stat.storeDisplayName,
                context: chunksText,
                chunkCount: stat.chunkCount
            };
        });

        // Step 4: Generate synthesis prompt with STRICT output format requirements
        const synthesisPrompt = `You are an AI assistant helping users search across multiple independent knowledge sources.

USER QUESTION:
${query}

RETRIEVED INFORMATION FROM EACH SOURCE:

${perStoreContexts.map(store => 
`=== SOURCE: ${store.displayName} (${store.chunkCount} chunks) ===
${store.context}
`).join('\n\n')}

CRITICAL INSTRUCTIONS:
1. You MUST provide a response in the following EXACT format:

## Overall Summary
[Provide a comprehensive summary synthesizing information from ALL sources. Include cross-source insights and connections.]

## Per-Source Details

${perStoreContexts.map(store => 
`### ${store.displayName}
[Provide detailed information based ONLY on ${store.displayName}'s retrieved content. DO NOT mix information from other sources here. If no relevant information exists in this source, state "No relevant information found in this source."]`).join('\n\n')}

2. In the "Overall Summary" section:
   - Synthesize insights from all available sources
   - Identify patterns, connections, or conflicts across sources
   - Provide a holistic view of the answer

3. In each "Per-Source Details" section:
   - Use ONLY the information from that specific source
   - Do NOT include information from other sources
   - Be explicit if that source lacks relevant information
   
4. Maintain the markdown format EXACTLY as shown above

Generate your response now:`;

        console.log("Synthesizing final answer with strict format requirements");
        
        // Step 5: ONE final LLM call for synthesis (no File Search, pure generation)
        const synthesisResult = await generateResponse(synthesisPrompt);

        console.log("Multi-store search complete:", {
            totalChunks: aggregatedChunks.length,
            successfulStores: storeStats.filter(s => s.success).length,
            failedStores: storeStats.filter(s => !s.success).length
        });

        return NextResponse.json({
            answer: synthesisResult || "Unable to generate an answer from the retrieved information.",
            storeStats,
            aggregatedChunks,
            totalChunks: aggregatedChunks.length
        });

    } catch (error) {
        console.error("Multi-store search failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Multi-store search failed: ${errorMessage}` },
            { status: 500 }
        );
    }
}
