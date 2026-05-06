import { NextRequest, NextResponse } from "next/server";
import { getMeetingMetadata } from "@/lib/meetingStorage";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const metadata = await getMeetingMetadata(decodeURIComponent(id));

        if (!metadata) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        return NextResponse.json(metadata);
    } catch (error) {
        console.error("[get-metadata] Error:", error);
        return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 });
    }
}
