/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RagStore, Document, QueryResult, CustomMetadata, GroundingChunk } from '../types.js';

import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

let ai: GoogleGenAI;

export function initialize() {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
}

// Auto-initialize to ensure it's always available
function ensureInitialized() {
    if (!ai) {
        initialize();
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createRagStore(displayName: string): Promise<string> {
    ensureInitialized();
    const ragStore = await ai.fileSearchStores.create({ config: { displayName } });
    if (!ragStore.name) {
        throw new Error("Failed to create RAG store: name is missing.");
    }
    return ragStore.name;
}

export async function uploadToRagStore(
    ragStoreName: string, 
    filePath: string,
    mimeType: string,
    displayName?: string,
    customMetadata?: CustomMetadata[]
): Promise<void> {
    ensureInitialized();
    
    const uploadConfig: any = {
        fileSearchStoreName: ragStoreName,
        file: filePath
    };
    
    // Build config object
    const config: any = {};
    
    // Explicitly set the display name
    if (displayName) {
        config.displayName = displayName;
    }
    
    if (mimeType) {
        config.mimeType = mimeType;
    }
    
    // Add custom metadata if provided
    if (customMetadata && customMetadata.length > 0) {
        config.customMetadata = customMetadata;
    }
    
    // Only add config if it has properties
    if (Object.keys(config).length > 0) {
        uploadConfig.config = config;
    }
    
    try {
        console.log(`Starting upload to RAG store: ${displayName}`);
        let op = await ai.fileSearchStores.uploadToFileSearchStore(uploadConfig);
        console.log(`Upload operation created, waiting for completion...`);

        while (!op.done) {
            await delay(3000); 
            op = await ai.operations.get({operation: op});
        }
        
        console.log(`✓ Successfully uploaded to RAG store: ${displayName}`);
        console.log(`Note: Document may need a few seconds to be indexed and queryable`);
    } catch (error: any) {
        // Provide more context in the error
        const errorMsg = error?.message || String(error);
        console.error(`✗ RAG store upload failed for ${displayName}:`, errorMsg);
        throw new Error(`RAG store upload failed for ${displayName}: ${errorMsg}`);
    }
}

/**
 * @deprecated - No longer needed with simplified project model
 * Save project metadata to RAG store as a special document
 * This allows projects to be listed even when they have no meetings yet
 */
export async function saveProjectMetadata(
    ragStoreName: string,
    displayName: string,
    projectData: any
): Promise<void> {
    ensureInitialized();
    
    let tempPath: string | null = null;

    try {
        // Create a text file with project metadata
        const projectInfo = JSON.stringify(projectData, null, 2);
        
        // Write to temp file
        const fileName = `project-metadata.txt`;
        tempPath = path.join(os.tmpdir(), fileName);
        await writeFile(tempPath, projectInfo);
        
        // Upload with special metadata to identify as project metadata
        const customMetadata = [
            { key: 'displayName', stringValue: displayName },
            { key: 'documentType', stringValue: 'project-metadata' },
        ];
        
        await uploadToRagStore(ragStoreName, tempPath, 'text/plain', fileName, customMetadata);
        console.log(`Project metadata saved for ${displayName}`);
    } catch (error) {
        console.error(`Failed to save project metadata for ${displayName}:`, error);
        throw error;
    } finally {
        if (tempPath) {
            try {
                await unlink(tempPath);
            } catch (e) {
                console.warn('Failed to delete temp file:', tempPath);
            }
        }
    }
}

/**
 * Analyze meeting document and generate summary and action items
 */
export async function analyzeMeeting(documentName: string): Promise<{ summary: string; actionItems: string[]; metadata: any } | null> {
    ensureInitialized();
    
    // Decode URL-encoded document name
    const decodedDocumentName = decodeURIComponent(documentName);
    
    console.log('Analyzing meeting document:', decodedDocumentName);
    
    try {
        // Get document details
        const doc = await ai.fileSearchStores.documents.get({ name: decodedDocumentName });
        
        if (!doc) {
            console.error(`Document not found: ${decodedDocumentName}`);
            return null;
        }
        
        // Check if this is a project metadata document
        const isProjectMetadata = doc.customMetadata?.some(m => m.key === 'documentType' && m.stringValue === 'project-metadata');
        
        if (isProjectMetadata) {
            console.log('Cannot analyze project metadata document');
            return null;
        }
        
        // Extract the store name from document name
        const storeNameMatch = decodedDocumentName.match(/^(fileSearchStores\/[^\/]+)/);
        if (!storeNameMatch) {
            throw new Error('Invalid document name format');
        }
        const storeName = storeNameMatch[1];
        
        const displayName = doc.displayName || decodedDocumentName.split('/').pop() || 'Document';
        
        // Generate analysis using file search
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the meeting transcript "${displayName}" and provide:

1. A concise summary (2-3 paragraphs) covering the main topics discussed, key decisions made, and overall meeting outcome.

2. A list of action items extracted from the meeting. Each action item should be clear and actionable.

Format your response exactly as:

SUMMARY:
[Your summary here]

ACTION ITEMS:
- [Action item 1]
- [Action item 2]
- [etc.]

If there are no action items, write "ACTION ITEMS:\n- No action items identified"`,
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [storeName]
                        }
                    }
                ]
            }
        });
        
        const analysisText = response.text || "";
        
        // Parse the response
        const summaryMatch = analysisText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
        const actionItemsMatch = analysisText.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
        
        const summary = summaryMatch ? summaryMatch[1].trim() : "Unable to generate summary.";
        const actionItemsText = actionItemsMatch ? actionItemsMatch[1].trim() : "";
        
        // Parse action items (each line starting with - or numbered)
        const actionItems = actionItemsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.?\s*/, '').trim())
            .filter(line => line.length > 0);
        
        return {
            summary,
            actionItems: actionItems.length > 0 ? actionItems : ["No action items identified"],
            metadata: {
                displayName: displayName,
                mimeType: doc.mimeType,
                createTime: doc.createTime,
                customMetadata: doc.customMetadata
            }
        };
    } catch (error) {
        console.error(`Failed to get document content for ${decodedDocumentName}:`, error);
        return null;
    }
}

/**
 * NEW FUNCTION: Retrieve relevant chunks from File Search WITHOUT generating an answer.
 * This function uses File Search ONLY for retrieval, not generation.
 * Used in multi-store architecture where generation happens separately.
 */
export async function retrieveChunks(ragStoreName: string, query: string): Promise<GroundingChunk[]> {
    ensureInitialized();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Find relevant information for: ${query}`,
        config: {
            tools: [
                {
                    fileSearch: {
                        fileSearchStoreNames: [ragStoreName],
                    }
                }
            ]
        }
    });

    return response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
}

/**
 * NEW FUNCTION: Generate a response using the LLM WITHOUT File Search.
 * This function performs pure generation without retrieval.
 * Used for synthesis after multi-store retrieval is complete.
 */
export async function generateResponse(prompt: string): Promise<string> {
    ensureInitialized();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            maxOutputTokens: 8192,
            temperature: 0.7,
            topP: 0.95,
            topK: 40
        }
    });

    return response.text || '';
}

export async function fileSearch(ragStoreName: string, query: string): Promise<QueryResult> {
    ensureInitialized();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query + "DO NOT ASK THE USER TO READ THE MANUAL, pinpoint the relevant sections in the response itself. If the information is not explicitly stated in the transcripts, respond with ‘Not mentioned in the uploaded files.",
        config: {
            tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [ragStoreName],
                        }
                    }
                ]
        }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return {
        text: response.text || '',
        groundingChunks: groundingChunks,
    };
}

export async function generateExampleQuestions(
    ragStoreName: string, 
    contextType: "project" | "meeting",
    contextId: string
): Promise<string[]> {
    ensureInitialized();
    try {
        // First, verify that documents exist in the RAG store
        const documents = await listDocumentsInRagStore(ragStoreName);
        console.log(`Total documents in RAG store: ${documents.length}`);
        
        const validDocuments = documents.filter(doc => !doc.displayName?.startsWith('.project-metadata'));
        
        if (validDocuments.length === 0) {
            console.log(`No valid meeting documents found in RAG store ${ragStoreName}`);
            console.log(`All documents: ${documents.map(d => d.displayName).join(', ') || 'none'}`);
            console.log(`Note: If you just uploaded a document, it may take 5-10 seconds to be indexed`);
            return [];
        }
        
        console.log(`Found ${validDocuments.length} valid document(s) for example questions:`);
        validDocuments.forEach(doc => console.log(`  - ${doc.displayName}`));
        
        // Build enhanced prompt based on context type
        let promptContext = "";
        
        if (contextType === "project") {
            // For projects, instruct AI to analyze all documents in this project-specific store
            promptContext = `Analyze the uploaded meeting transcripts and documents from this project. The store contains ${validDocuments.length} document(s). Identify the main topics or subjects covered across these documents.`;
        } else if (contextType === "meeting") {
            // For meetings, focus on the specific meeting document
            promptContext = `Focus on the meeting transcript: ${contextId}. Analyze this specific meeting.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${promptContext} Based on the actual content in the documents, generate 3 short and practical example questions that a user might ask. Return ONLY a JSON array of question strings. For example: ["What were the main action items?", "Who is responsible for the project?", "What is the deadline?"]`,
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [ragStoreName]
                        }
                    }
                ]
            }
        });
        
        if (!response.text) {
            console.warn("No text response received for example questions");
            return [];
        }
        
        let jsonText = response.text.trim();

        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        } else {
            const firstBracket = jsonText.indexOf('[');
            const lastBracket = jsonText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                jsonText = jsonText.substring(firstBracket, lastBracket + 1);
            }
        }
        
        let parsedData;
        try {
            parsedData = JSON.parse(jsonText);
        } catch (parseError) {
            console.warn("AI did not return valid JSON for example questions. Response:", jsonText.substring(0, 200));
            return [];
        }
        
        if (Array.isArray(parsedData)) {
            // Filter and return only valid string questions, limit to 3
            return parsedData
                .filter(q => typeof q === 'string')
                .slice(0, 3);
        }
        
        console.warn("Received unexpected format for example questions:", parsedData);
        return [];
    } catch (error) {
        console.error("Failed to generate or parse example questions:", error);
        return [];
    }
}

export async function listDocumentsInRagStore(ragStoreName: string): Promise<Meeting[]> {
    ensureInitialized();
    
    const documents: Meeting[] = [];
    
    try {
        const pager = await ai.fileSearchStores.documents.list({
            parent: ragStoreName,
            config: {
                pageSize: 20
            }
        });
        
        // Iterate through all documents in the RAG store
        for await (const doc of pager) {
            if (doc.name) {
                documents.push({
                    name: doc.name,
                    displayName: doc.displayName || '',
                    uploadTime: doc.createTime,
                    mimeType: doc.mimeType
                });
            }
        }
        
        return documents;
    } catch (error) {
        console.error(`Failed to list documents in RAG store ${ragStoreName}:`, error);
        return []; // Return empty array if listing fails
    }
}

export async function listAllRagStores(): Promise<RagStore[]> {
    ensureInitialized();
    
    const allStores: RagStore[] = [];
    
    try {
        const pager = await ai.fileSearchStores.list({
            config: {
                pageSize: 20
            }
        });
        
        // Iterate through all pages using the pager
        for await (const store of pager) {
            // Only include stores with a valid name
            if (store.name) {
                allStores.push({
                    name: store.name,
                    displayName: store.displayName,
                    createTime: store.createTime
                });
            }
        }
        
        return allStores;
    } catch (error) {
        console.error('Failed to list RAG stores:', error);
        throw new Error(`Failed to list RAG stores: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export interface Meeting {
    name: string;
    displayName: string;
    uploadTime?: string;
    mimeType?: string;
}

export interface Project {
    name: string;          // RAG store resource name (e.g., "fileSearchStores/abc-123") - acts as primary key
    displayName: string;   // User-entered project name for display
    color?: string;
    createdAt: string;
    meetings: Meeting[];
    meetingCount: number;
}

export async function listAllProjects(): Promise<Project[]> {
    ensureInitialized();
    
    try {
        const ragStores = await listAllRagStores();
        
        // No filtering needed - all RAG stores are potential projects
        // We'll rely on metadata to identify project stores vs other types
        
        const allProjects: Project[] = [];
        
        for (const store of ragStores) {
            if (!store.name || !store.displayName) continue;
            
            // Skip system stores (User_, System_, etc.)
            if (store.displayName.startsWith('User_') || store.displayName.startsWith('System_')) {
                continue;
            }
            
            try {
                // Fetch all documents in this RAG store
                const allDocs = await listDocumentsInRagStore(store.name);
                
                // Separate metadata document from actual meetings
                const meetings = allDocs.filter(doc => doc.displayName !== '.project-metadata.json');
                
                // Try to get display name and color from metadata document
                let displayName = store.displayName;
                let color = 'bg-blue-500'; // default color
                const metadataDoc = allDocs.find(doc => doc.displayName === '.project-metadata.json');
                
                if (metadataDoc?.name) {
                    try {
                        const doc = await ai.fileSearchStores.documents.get({ name: metadataDoc.name });
                        const displayNameMetadata = doc.customMetadata?.find(m => m.key === 'displayName');
                        const colorMetadata = doc.customMetadata?.find(m => m.key === 'color');
                        
                        if (displayNameMetadata?.stringValue) {
                            displayName = displayNameMetadata.stringValue;
                        }
                        if (colorMetadata?.stringValue) {
                            color = colorMetadata.stringValue;
                        }
                    } catch (error) {
                        console.warn(`Failed to get project metadata:`, error);
                    }
                }
                
                allProjects.push({
                    name: store.name,              // RAG store resource name (fileSearchStores/xyz)
                    displayName: displayName,       // User-entered project name
                    color: color,
                    createdAt: store.createTime || new Date().toISOString(),
                    meetings: meetings,
                    meetingCount: meetings.length,
                });
            } catch (error) {
                console.error(`Failed to process project store ${store.name}:`, error);
                continue;
            }
        }
        
        // No duplicate removal needed since 'name' (RAG store resource name) is unique by design
        return allProjects;
    } catch (error) {
        console.error('Failed to list projects:', error);
        throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get or create a project's RAG store by name. Each project has its own dedicated RAG store.
 * This provides complete isolation between projects.
 * 
 * @param projectName - The RAG store resource name (e.g., "fileSearchStores/abc-123"). If provided, returns this name.
 * @param displayName - The user-entered project name. Required when creating a new store.
 * @param color - Optional color for the project.
 * @returns The RAG store resource name
 */
export async function getProjectRagStore(projectName?: string, displayName?: string, color?: string): Promise<string> {
    ensureInitialized();
    
    // If projectName is provided, it means the store already exists - just return it
    if (projectName && projectName.trim() !== '') {
        console.log(`[getProjectRagStore] Using existing RAG store: ${projectName}`);
        return projectName.trim();
    }
    
    // Creating new store - displayName is required
    if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
        throw new Error('displayName is required when creating a new RAG store');
    }
    
    try {
        // Create new RAG store with the user's displayName
        // The API will generate a unique resource name automatically
        console.log(`[getProjectRagStore] Creating new RAG store with displayName: ${displayName}`);
        const ragStoreName = await createRagStore(displayName.trim());
        console.log(`[getProjectRagStore] ✓ Created RAG store: ${ragStoreName}`);
        
        // Save project metadata if color is provided
        if (color) {
            let tempPath: string | null = null;
            try {
                const metadata = { displayName, color, createdAt: new Date().toISOString() };
                const fileName = '.project-metadata.json';
                
                tempPath = path.join(os.tmpdir(), `project-meta-${Date.now()}.json`);
                await writeFile(tempPath, JSON.stringify(metadata, null, 2));
                
                const customMetadata = [
                    { key: 'displayName', stringValue: displayName },
                    { key: 'isMetadata', stringValue: 'true' },
                    { key: 'color', stringValue: color }
                ];
                
                await uploadToRagStore(ragStoreName, tempPath, 'application/json', fileName, customMetadata);
                console.log(`Project metadata saved for ${displayName}`);
            } catch (metaError) {
                console.warn(`Failed to save project metadata:`, metaError);
                // Don't fail the whole operation if metadata save fails
            } finally {
                if (tempPath) {
                    try {
                        await unlink(tempPath);
                    } catch (e) {
                         // ignore cleanup error
                    }
                }
            }
        }
        
        return ragStoreName;
    } catch (error) {
        console.error(`Failed to create RAG store for project ${displayName}:`, error);
        throw new Error(`Failed to create RAG store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * @deprecated - No longer needed with per-project RAG stores
 * Get or create a user's RAG store. Each user has only one RAG store.
 * All projects and meetings for a user are stored in this single store,
 * distinguished by custom metadata.
 */
export async function getUserRagStore(userId: string): Promise<string> {
    ensureInitialized();
    
    const displayName = `User_${userId}`;
    
    try {
        // Check if user already has a RAG store
        const ragStores = await listAllRagStores();
        const existingStore = ragStores.find(store => store.displayName === displayName);
        
        if (existingStore && existingStore.name) {
            console.log(`Found existing RAG store for user ${userId}: ${existingStore.name}`);
            return existingStore.name;
        }
        
        // Create new RAG store if not exists
        const ragStoreName = await createRagStore(displayName);
        console.log(`RAG store created for user ${userId}: ${ragStoreName}`);
        return ragStoreName;
    } catch (error) {
        console.error(`Failed to get/create RAG store for user ${userId}:`, error);
        throw new Error(`Failed to get/create RAG store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Check if any projects exist by checking for RAG stores (excluding system stores)
 */
export async function userHasProjects(userId: string): Promise<boolean> {
    ensureInitialized();
    
    try {
        const ragStores = await listAllRagStores();
        // Check if any stores exist that aren't system stores
        const projectStores = ragStores.filter(store => 
            !store.displayName?.startsWith('User_') && 
            !store.displayName?.startsWith('System_')
        );
        return projectStores.length > 0;
    } catch (error) {
        console.error(`Failed to check if user ${userId} has projects:`, error);
        return false;
    }
}

export async function deleteRagStore(ragStoreName: string): Promise<void> {
    if (!ai) {
        console.warn("Gemini AI not initialized, skipping RAG store deletion");
        return;
    }
    // DO: Remove `(as any)` type assertion.
    await ai.fileSearchStores.delete({
        name: ragStoreName,
        config: { force: true },
    });
}
