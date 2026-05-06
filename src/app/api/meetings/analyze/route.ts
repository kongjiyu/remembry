import { NextRequest, NextResponse } from 'next/server';
import { initialize, analyzeMeeting } from '@/lib/fileSearch';
import { resolveGeminiApiKeyForRequest } from '@/lib/userKey';

// Initialize AI on module load
initialize();

export async function GET(
    request: NextRequest
) {
    try {
        const apiKey = await resolveGeminiApiKeyForRequest(request);
        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key not found. Please add your API key in Settings." },
                { status: 400 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const documentName = searchParams.get('documentName');
        
        console.log('Analyzing meeting:', documentName);
        
        if (!documentName) {
            return NextResponse.json(
                { error: 'Document name is required' },
                { status: 400 }
            );
        }

        const analysis = await analyzeMeeting(documentName, apiKey);

        if (!analysis) {
            return NextResponse.json(
                { error: 'Meeting not found or failed to analyze' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            meeting: analysis,
        });
    } catch (error) {
        console.error('Error analyzing meeting:', error);
        return NextResponse.json(
            { error: 'Failed to analyze meeting' },
            { status: 500 }
        );
    }
}
