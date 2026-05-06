import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const REMEMBRY_USER_ID_HEADER = "x-remembry-user-id";

interface UserGeminiKeyRow {
    user_id: string;
    gemini_api_key: string;
    created_at: string;
    last_used: string | null;
    usage_count: number;
}

interface ApiKeyStatusResponse {
    hasKey: boolean;
    maskedKey: string | null;
    keyPrefix: string | null;
    keySuffix: string | null;
    createdAt: string | null;
    lastUsed: string | null;
    usageCount: number;
}

export function getUserIdFromRequest(request: NextRequest): string | null {
    const userId = request.headers.get(REMEMBRY_USER_ID_HEADER)?.trim();
    if (!userId) {
        return null;
    }
    return userId;
}

export async function getStoredGeminiApiKey(userId: string): Promise<string | null> {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
        .from("user_gemini_keys")
        .select("user_id, gemini_api_key, created_at, last_used, usage_count")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to load Gemini API key: ${error.message}`);
    }

    const row = data as UserGeminiKeyRow | null;
    return row?.gemini_api_key?.trim() || null;
}

export async function getStoredGeminiKeyStatus(userId: string): Promise<ApiKeyStatusResponse> {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
        .from("user_gemini_keys")
        .select("user_id, gemini_api_key, created_at, last_used, usage_count")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to load Gemini API key: ${error.message}`);
    }

    const row = data as UserGeminiKeyRow | null;
    const hasKey = Boolean(row?.gemini_api_key?.trim());

    if (!hasKey || !row) {
        return {
            hasKey: false,
            maskedKey: null,
            keyPrefix: null,
            keySuffix: null,
            createdAt: null,
            lastUsed: null,
            usageCount: 0,
        };
    }

    const apiKey = row.gemini_api_key.trim();
    return {
        hasKey: true,
        maskedKey: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
        keyPrefix: apiKey.slice(0, 6),
        keySuffix: apiKey.slice(-4),
        createdAt: row.created_at,
        lastUsed: row.last_used,
        usageCount: row.usage_count || 0,
    };
}

export async function saveGeminiApiKey(userId: string, geminiApiKey: string): Promise<void> {
    const supabase = getSupabaseServerClient();

    // Check if key already exists
    const { data: existing } = await supabase
        .from("user_gemini_keys")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (existing) {
        // Update existing
        const { error } = await supabase
            .from("user_gemini_keys")
            .update({
                gemini_api_key: geminiApiKey,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (error) {
            throw new Error(`Failed to update Gemini API key: ${error.message}`);
        }
    } else {
        // Insert new
        const { error } = await supabase.from("user_gemini_keys").insert({
            user_id: userId,
            gemini_api_key: geminiApiKey,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            throw new Error(`Failed to save Gemini API key: ${error.message}`);
        }
    }
}

export async function deleteGeminiApiKey(userId: string): Promise<void> {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase
        .from("user_gemini_keys")
        .delete()
        .eq("user_id", userId);

    if (error) {
        throw new Error(`Failed to delete Gemini API key: ${error.message}`);
    }
}

export async function incrementGeminiKeyUsageCount(userId: string): Promise<void> {
    const supabase = getSupabaseServerClient();

    await supabase.rpc("increment_usage_count", { p_user_id: userId }).catch(() => {
        // Fallback if RPC doesn't exist
        // Just update last_used timestamp
        supabase
            .from("user_gemini_keys")
            .update({ last_used: new Date().toISOString() })
            .eq("user_id", userId);
    });
}

export async function resolveGeminiApiKeyForRequest(request: NextRequest): Promise<string | null> {
    const userId = getUserIdFromRequest(request);

    if (!userId) {
        return null;
    }

    return getStoredGeminiApiKey(userId);
}
