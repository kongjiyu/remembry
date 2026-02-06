import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const decodedId = decodeURIComponent(id);
        
        const uploadsDir = path.join(process.cwd(), "uploads", decodedId);
        
        if (!existsSync(uploadsDir)) {
            return NextResponse.json(
                { error: "Meeting not found" },
                { status: 404 }
            );
        }

        // Try to read metadata.json first
        const metadataPath = path.join(uploadsDir, "metadata.json");
        
        if (existsSync(metadataPath)) {
            const metadataData = await readFile(metadataPath, "utf-8");
            const metadata = JSON.parse(metadataData);
            return NextResponse.json(metadata);
        }

        // If no metadata.json, scan for notes-*.json files to determine available languages
        const files = readdirSync(uploadsDir);
        const notesFiles = files.filter(f => f.startsWith('notes-') && f.endsWith('.json'));
        const availableLanguages: string[] = notesFiles.map(f => {
            const match = f.match(/notes-(.+)\.json/);
            return match ? match[1] : null;
        }).filter((lang): lang is string => lang !== null);

        // Check if default notes.json exists (implies 'en' if no language-specific file)
        if (existsSync(path.join(uploadsDir, "notes.json")) && !availableLanguages.includes('en')) {
            availableLanguages.unshift('en');
        }

        // If no languages found, default to 'en'
        if (availableLanguages.length === 0) {
            availableLanguages.push('en');
        }

        return NextResponse.json({
            availableLanguages,
            defaultLanguage: availableLanguages[0],
            createdAt: null
        });

    } catch (error) {
        console.error("[get-metadata] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch metadata" },
            { status: 500 }
        );
    }
}
