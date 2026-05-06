import { GoogleGenAI } from "@google/genai";
import { SupabaseClient } from "@supabase/supabase-js";
import { RagStore, CustomMetadata } from "../types";
import { readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

type ProjectRow = {
    id: string;
    display_name: string;
    color: string | null;
    created_at: string;
};

type DocumentRow = {
    id: string;
    project_id: string;
    display_name: string;
    mime_type: string | null;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

export interface Meeting {
    name: string;
    displayName: string;
    uploadTime?: string;
    mimeType?: string;
}

export interface Project {
    name: string;
    displayName: string;
    color?: string;
    createdAt: string;
    meetings: Meeting[];
    meetingCount: number;
}

let supabase: SupabaseClient | null = null;

const GENERATION_MODEL = "gemini-3-flash-preview"; // Analysis/generation tasks
const DEFAULT_PROJECT_COLOR = "bg-blue-500";

function getGeminiClient(apiKey?: string): GoogleGenAI {
    const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!resolvedApiKey) {
        throw new Error("Gemini API key is not set");
    }
    return new GoogleGenAI({ apiKey: resolvedApiKey });
}

export function initialize() {
    if (!supabase) {
        supabase = getSupabaseServerClient();
    }
}

function ensureInitialized() {
    if (!supabase) {
        initialize();
    }
}

function getSupabase(): SupabaseClient {
    ensureInitialized();
    return supabase as SupabaseClient;
}

function normalizeMetadata(customMetadata?: CustomMetadata[]): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (!customMetadata) {
        return metadata;
    }

    for (const item of customMetadata) {
        const key = item.key?.trim();
        if (!key) continue;

        if (typeof item.stringValue === "string") {
            metadata[key] = item.stringValue;
            continue;
        }

        if (Array.isArray(item.stringListValue)) {
            metadata[key] = item.stringListValue;
            continue;
        }

        if (typeof item.numericValue === "number") {
            metadata[key] = item.numericValue;
        }
    }

    return metadata;
}

function metadataToCustomMetadata(metadata: Record<string, unknown> | null | undefined): CustomMetadata[] {
    if (!metadata) return [];

    return Object.entries(metadata).map(([key, value]) => {
        if (Array.isArray(value)) {
            return { key, stringListValue: value.map((v) => String(v)) };
        }

        if (typeof value === "number") {
            return { key, numericValue: value };
        }

        return { key, stringValue: String(value) };
    });
}

async function getDocumentsForProject(projectId: string): Promise<DocumentRow[]> {
    const client = getSupabase();
    const { data, error } = await client
        .from("project_documents")
        .select("id, project_id, display_name, mime_type, content, metadata, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to load project documents: ${error.message}`);
    }

    return (data || []) as DocumentRow[];
}

export async function createRagStore(displayName: string): Promise<string> {
    const client = getSupabase();
    const projectId = `project_${randomUUID()}`;

    const { error } = await client.from("projects").insert({
        id: projectId,
        display_name: displayName,
        color: DEFAULT_PROJECT_COLOR,
    });

    if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
    }

    return projectId;
}

export async function uploadToRagStore(
    ragStoreName: string,
    filePath: string,
    mimeType: string,
    displayName?: string,
    customMetadata?: CustomMetadata[]
): Promise<void> {
    const client = getSupabase();
    const content = await readFile(filePath, "utf-8");
    const metadata = normalizeMetadata(customMetadata);

    const documentId = `documents/${randomUUID()}`;
    const { error } = await client.from("project_documents").insert({
        id: documentId,
        project_id: ragStoreName,
        display_name: displayName || documentId,
        mime_type: mimeType,
        content,
        metadata,
    });

    if (error) {
        throw new Error(`Failed to save document to Supabase: ${error.message}`);
    }
}

export async function saveProjectMetadata(
    ragStoreName: string,
    displayName: string,
    projectData: unknown
): Promise<void> {
    void ragStoreName;
    void displayName;
    void projectData;
    return;
}

export async function analyzeMeeting(
    documentName: string,
    apiKey?: string
): Promise<{ summary: string; actionItems: string[]; metadata: unknown } | null> {
    const client = getSupabase();
    const decodedDocumentName = decodeURIComponent(documentName);

    const { data, error } = await client
        .from("project_documents")
        .select("id, project_id, display_name, mime_type, content, metadata, created_at")
        .eq("id", decodedDocumentName)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to load document: ${error.message}`);
    }

    if (!data) {
        return null;
    }

    const doc = data as DocumentRow;
    const prompt = `Analyze the following meeting transcript and provide:\n\n1. A concise summary (2-3 paragraphs) covering the main topics discussed, key decisions made, and overall meeting outcome.\n\n2. A list of action items extracted from the meeting. Each action item should be clear and actionable.\n\nFormat your response exactly as:\n\nSUMMARY:\n[Your summary here]\n\nACTION ITEMS:\n- [Action item 1]\n- [Action item 2]\n- [etc.]\n\nIf there are no action items, write \"ACTION ITEMS:\\n- No action items identified\"\n\nTRANSCRIPT:\n${doc.content}`;

    const response = await getGeminiClient(apiKey).models.generateContent({
        model: GENERATION_MODEL,
        contents: prompt,
    });

    const analysisText = response.text || "";
    const summaryMatch = analysisText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
    const actionItemsMatch = analysisText.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : "Unable to generate summary.";
    const actionItemsText = actionItemsMatch ? actionItemsMatch[1].trim() : "";

    const actionItems = actionItemsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^[-•*]\s*/, "").replace(/^\d+\.?\s*/, "").trim())
        .filter((line) => line.length > 0);

    return {
        summary,
        actionItems: actionItems.length > 0 ? actionItems : ["No action items identified"],
        metadata: {
            displayName: doc.display_name,
            mimeType: doc.mime_type,
            createTime: doc.created_at,
            customMetadata: metadataToCustomMetadata(doc.metadata),
            projectId: doc.project_id,
        },
    };
}

export async function listAllRagStores(): Promise<RagStore[]> {
    const client = getSupabase();
    const { data, error } = await client
        .from("projects")
        .select("id, display_name, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to list projects: ${error.message}`);
    }

    return ((data || []) as ProjectRow[]).map((row) => ({
        name: row.id,
        displayName: row.display_name,
        createTime: row.created_at,
    }));
}

export async function listAllProjects(): Promise<Project[]> {
    const client = getSupabase();
    const [{ data: projectData, error: projectError }, { data: docsData, error: docsError }] = await Promise.all([
        client.from("projects").select("id, display_name, color, created_at").order("created_at", { ascending: false }),
        client
            .from("project_documents")
            .select("id, project_id, display_name, mime_type, created_at")
            .order("created_at", { ascending: false }),
    ]);

    if (projectError) {
        throw new Error(`Failed to list projects: ${projectError.message}`);
    }

    if (docsError) {
        throw new Error(`Failed to list project documents: ${docsError.message}`);
    }

    const meetingsByProject = new Map<string, Meeting[]>();

    for (const doc of ((docsData || []) as Array<Pick<DocumentRow, "id" | "project_id" | "display_name" | "mime_type" | "created_at">>)) {
        const existing = meetingsByProject.get(doc.project_id) || [];
        existing.push({
            name: doc.id,
            displayName: doc.display_name,
            uploadTime: doc.created_at,
            mimeType: doc.mime_type || undefined,
        });
        meetingsByProject.set(doc.project_id, existing);
    }

    return ((projectData || []) as ProjectRow[]).map((project) => {
        const meetings = meetingsByProject.get(project.id) || [];

        return {
            name: project.id,
            displayName: project.display_name,
            color: project.color || DEFAULT_PROJECT_COLOR,
            createdAt: project.created_at,
            meetings,
            meetingCount: meetings.length,
        };
    });
}

export async function getProjectRagStore(projectName?: string, displayName?: string, color?: string): Promise<string> {
    if (projectName && projectName.trim()) {
        return projectName.trim();
    }

    if (!displayName || !displayName.trim()) {
        throw new Error("displayName is required when creating a new project");
    }

    const client = getSupabase();
    const projectId = `project_${randomUUID()}`;

    const { error } = await client.from("projects").insert({
        id: projectId,
        display_name: displayName.trim(),
        color: color || DEFAULT_PROJECT_COLOR,
    });

    if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
    }

    return projectId;
}

export async function getUserRagStore(userId: string): Promise<string> {
    const client = getSupabase();
    const displayName = `User_${userId}`;

    const { data: existing, error: existingError } = await client
        .from("projects")
        .select("id")
        .eq("display_name", displayName)
        .maybeSingle();

    if (existingError) {
        throw new Error(`Failed to get user project: ${existingError.message}`);
    }

    if (existing?.id) {
        return existing.id;
    }

    const projectId = `project_${randomUUID()}`;
    const { error: insertError } = await client.from("projects").insert({
        id: projectId,
        display_name: displayName,
        color: DEFAULT_PROJECT_COLOR,
    });

    if (insertError) {
        throw new Error(`Failed to create user project: ${insertError.message}`);
    }

    return projectId;
}

export async function userHasProjects(userId: string): Promise<boolean> {
    void userId;
    const client = getSupabase();
    const { data, error } = await client
        .from("projects")
        .select("id")
        .not("display_name", "like", "User_%")
        .not("display_name", "like", "System_%")
        .limit(1);

    if (error) {
        return false;
    }

    return (data || []).length > 0;
}

export async function deleteRagStore(ragStoreName: string): Promise<void> {
    const client = getSupabase();

    const { error: docsError } = await client.from("project_documents").delete().eq("project_id", ragStoreName);
    if (docsError) {
        throw new Error(`Failed to delete project documents: ${docsError.message}`);
    }

    const { error: projectError } = await client.from("projects").delete().eq("id", ragStoreName);
    if (projectError) {
        throw new Error(`Failed to delete project: ${projectError.message}`);
    }
}
