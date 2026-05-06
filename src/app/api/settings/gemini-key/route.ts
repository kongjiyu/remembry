import { NextRequest, NextResponse } from "next/server";
import {
    getStoredGeminiKeyStatus,
    getUserIdFromRequest,
    saveGeminiApiKey,
    deleteGeminiApiKey,
} from "@/lib/userKey";

export async function GET(request: NextRequest) {
    try {
        const userId = getUserIdFromRequest(request);

        if (!userId) {
            return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }

        const status = await getStoredGeminiKeyStatus(userId);

        return NextResponse.json(status);
    } catch (error) {
        console.error("Failed to fetch Gemini key status:", error);
        return NextResponse.json({ error: "Failed to fetch Gemini key status" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdFromRequest(request);

        if (!userId) {
            return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }

        const { apiKey } = await request.json();

        if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
            return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
        }

        if (!apiKey.trim().startsWith("AIza")) {
            return NextResponse.json({ error: "Invalid Gemini API key format" }, { status: 400 });
        }

        await saveGeminiApiKey(userId, apiKey.trim());

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save Gemini key:", error);
        return NextResponse.json({ error: "Failed to save Gemini key" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = getUserIdFromRequest(request);

        if (!userId) {
            return NextResponse.json({ error: "Missing user id" }, { status: 400 });
        }

        await deleteGeminiApiKey(userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete Gemini key:", error);
        return NextResponse.json({ error: "Failed to delete Gemini key" }, { status: 500 });
    }
}
