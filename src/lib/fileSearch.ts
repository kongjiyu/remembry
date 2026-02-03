/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RagStore, Document, QueryResult, CustomMetadata } from '../types.js';

let ai: GoogleGenAI;

export function initialize() {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createRagStore(displayName: string): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");
    const ragStore = await ai.fileSearchStores.create({ config: { displayName } });
    if (!ragStore.name) {
        throw new Error("Failed to create RAG store: name is missing.");
    }
    return ragStore.name;
}

export async function uploadToRagStore(
    ragStoreName: string, 
    file: File, 
    customMetadata?: CustomMetadata[]
): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    const uploadConfig: any = {
        fileSearchStoreName: ragStoreName,
        file: file
    };
    
    // Build config object
    const config: any = {};
    
    // Explicitly set the display name to preserve the file name
    if (file.name) {
        config.displayName = file.name;
    }
    
    // Only add mimeType if the file has a valid type
    if (file.type && file.type.includes('/')) {
        config.mimeType = file.type;
    }
    
    // Add custom metadata if provided
    if (customMetadata && customMetadata.length > 0) {
        config.customMetadata = customMetadata;
    }
    
    // Only add config if it has properties
    if (Object.keys(config).length > 0) {
        uploadConfig.config = config;
    }
    
    let op = await ai.fileSearchStores.uploadToFileSearchStore(uploadConfig);

    while (!op.done) {
        await delay(3000); 
        op = await ai.operations.get({operation: op});
    }
}

/**
 * @deprecated - No longer needed with per-project RAG stores
 * Save project metadata to RAG store as a special document
 * This allows projects to be listed even when they have no meetings yet
 */
export async function saveProjectMetadata(
    ragStoreName: string,
    projectId: string,
    projectName: string,
    projectData: any
): Promise<void> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    try {
        // Create a text file with project metadata
        const projectInfo = JSON.stringify(projectData, null, 2);
        const blob = new Blob([projectInfo], { type: 'text/plain' });
        const file = new File([blob], `project-${projectId}.txt`, { type: 'text/plain' });
        
        // Upload with special metadata to identify as project metadata
        const customMetadata = [
            { key: 'project', stringValue: projectId },
            { key: 'projectName', stringValue: projectName },
            { key: 'documentType', stringValue: 'project-metadata' },
        ];
        
        await uploadToRagStore(ragStoreName, file, customMetadata);
        console.log(`Project metadata saved for ${projectName}`);
    } catch (error) {
        console.error(`Failed to save project metadata for ${projectName}:`, error);
        throw error;
    }
}

/**
 * Analyze meeting document and generate summary and action items
 */
export async function analyzeMeeting(documentName: string): Promise<{ summary: string; actionItems: string[]; metadata: any } | null> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    console.log('Analyzing meeting document:', documentName);
    
    try {
        // Get document details
        const doc = await ai.fileSearchStores.documents.get({ name: documentName });
        
        if (!doc) {
            console.error(`Document not found: ${documentName}`);
            return null;
        }
        
        // Check if this is a project metadata document
        const isProjectMetadata = doc.customMetadata?.some(m => m.key === 'documentType' && m.stringValue === 'project-metadata');
        
        if (isProjectMetadata) {
            console.log('Cannot analyze project metadata document');
            return null;
        }
        
        // Extract the store name from document name
        const storeNameMatch = documentName.match(/^(fileSearchStores\/[^\/]+)/);
        if (!storeNameMatch) {
            throw new Error('Invalid document name format');
        }
        const storeName = storeNameMatch[1];
        
        const displayName = doc.displayName || documentName.split('/').pop() || 'Document';
        
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
        console.error(`Failed to get document content for ${documentName}:`, error);
        return null;
    }
}

export async function fileSearch(ragStoreName: string, query: string): Promise<QueryResult> {
    if (!ai) throw new Error("Gemini AI not initialized");
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
    if (!ai) throw new Error("Gemini AI not initialized");
    try {
        // Build enhanced prompt based on context type
        let promptContext = "";
        
        if (contextType === "project") {
            // For projects, instruct AI to focus on documents with specific project ID
            promptContext = `Focus ONLY on documents that belong to project ID: ${contextId}. Analyze the uploaded documents from this specific project and identify the main topics or subjects covered.`;
        } else if (contextType === "meeting") {
            // For meetings, focus on the specific meeting document
            promptContext = `Focus ONLY on the meeting document: ${contextId}. Analyze this specific meeting transcript.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${promptContext} DO NOT GUESS OR HALLUCINATE. Generate 3 short and practical example questions that a user might ask about the content in English. Return ONLY a JSON array of question strings. For example: ["What were the main action items?", "Who is responsible for the project?", "What is the deadline?"]`,
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
    if (!ai) throw new Error("Gemini AI not initialized");
    
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
    if (!ai) throw new Error("Gemini AI not initialized");
    
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
    id: string;
    name: string;
    ragStoreName: string;
    displayName: string;
    createdAt: string;
    meetings: Meeting[];
    meetingCount: number;
}

export async function listAllProjects(): Promise<Project[]> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    try {
        const ragStores = await listAllRagStores();
        
        // Filter only project RAG stores (those starting with "Project_")
        const projectStores = ragStores.filter(store => store.displayName?.startsWith('Project_'));
        
        const allProjects: Project[] = [];
        
        for (const store of projectStores) {
            if (!store.name || !store.displayName) continue;
            
            try {
                // Extract project ID from display name (Project_<projectId>)
                const projectId = store.displayName.replace('Project_', '');
                
                // Fetch all documents in this project's RAG store
                const allDocs = await listDocumentsInRagStore(store.name);
                
                // Separate metadata document from actual meetings
                const meetings = allDocs.filter(doc => doc.displayName !== '.project-metadata.json');
                
                // Try to get project name from metadata document
                let projectName = `Project ${projectId.slice(0, 8)}`;
                const metadataDoc = allDocs.find(doc => doc.displayName === '.project-metadata.json');
                
                if (metadataDoc?.name) {
                    try {
                        const doc = await ai.fileSearchStores.documents.get({ name: metadataDoc.name });
                        const projectNameMetadata = doc.customMetadata?.find(m => m.key === 'projectName');
                        if (projectNameMetadata?.stringValue) {
                            projectName = projectNameMetadata.stringValue;
                        }
                    } catch (error) {
                        console.warn(`Failed to get project name from metadata:`, error);
                    }
                } else if (meetings.length > 0 && meetings[0].name) {
                    // Fallback: try to get from first meeting's metadata
                    try {
                        const doc = await ai.fileSearchStores.documents.get({ name: meetings[0].name });
                        const projectNameMetadata = doc.customMetadata?.find(m => m.key === 'projectName');
                        if (projectNameMetadata?.stringValue) {
                            projectName = projectNameMetadata.stringValue;
                        }
                    } catch (error) {
                        console.warn(`Failed to get project name from meeting metadata:`, error);
                    }
                }
                
                allProjects.push({
                    id: projectId,
                    name: projectName,
                    ragStoreName: store.name,
                    displayName: store.displayName,
                    createdAt: store.createTime || new Date().toISOString(),
                    meetings: meetings,
                    meetingCount: meetings.length,
                });
            } catch (error) {
                console.error(`Failed to process project store ${store.name}:`, error);
                continue;
            }
        }
        
        return allProjects;
    } catch (error) {
        console.error('Failed to list projects:', error);
        throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get or create a project's RAG store. Each project has its own dedicated RAG store.
 * This provides complete isolation between projects.
 */
export async function getProjectRagStore(projectId: string, projectName?: string): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    const displayName = `Project_${projectId}`;
    
    try {
        // Check if project already has a RAG store
        const ragStores = await listAllRagStores();
        const existingStore = ragStores.find(store => store.displayName === displayName);
        
        if (existingStore && existingStore.name) {
            console.log(`Found existing RAG store for project ${projectId}: ${existingStore.name}`);
            return existingStore.name;
        }
        
        // Create new RAG store for this project
        const ragStoreName = await createRagStore(displayName);
        console.log(`RAG store created for project ${projectId}: ${ragStoreName}`);
        
        // Save project name as metadata if provided
        if (projectName) {
            try {
                const metadata = { projectId, projectName, createdAt: new Date().toISOString() };
                const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'text/plain' });
                const file = new File([blob], '.project-metadata.json', { type: 'text/plain' });
                
                const customMetadata = [
                    { key: 'projectName', stringValue: projectName },
                    { key: 'isMetadata', stringValue: 'true' }
                ];
                
                await uploadToRagStore(ragStoreName, file, customMetadata);
                console.log(`Project name metadata saved for ${projectName}`);
            } catch (metaError) {
                console.warn(`Failed to save project name metadata:`, metaError);
                // Don't fail the whole operation if metadata save fails
            }
        }
        
        return ragStoreName;
    } catch (error) {
        console.error(`Failed to get/create RAG store for project ${projectId}:`, error);
        throw new Error(`Failed to get/create RAG store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * @deprecated - No longer needed with per-project RAG stores
 * Get or create a user's RAG store. Each user has only one RAG store.
 * All projects and meetings for a user are stored in this single store,
 * distinguished by custom metadata.
 */
export async function getUserRagStore(userId: string): Promise<string> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
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
 * Check if any projects exist by checking for Project RAG stores
 */
export async function userHasProjects(userId: string): Promise<boolean> {
    if (!ai) throw new Error("Gemini AI not initialized");
    
    try {
        const ragStores = await listAllRagStores();
        // Check if any Project_ stores exist
        const projectStores = ragStores.filter(store => store.displayName?.startsWith('Project_'));
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