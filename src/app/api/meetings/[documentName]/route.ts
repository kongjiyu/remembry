import { NextRequest, NextResponse } from 'next/server';
import { initialize, analyzeMeeting } from '@/lib/fileSearch';

// Initialize AI on module load
initialize();

export async function GET(
    request: NextRequest
) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const documentName = searchParams.get('documentName');
        
        console.log('Analyzing meeting:', documentName);
        
        if (!documentName) {
            return NextResponse.json(
                { error: 'Document name is required' },
                { status: 400 }
            );
        }

        const analysis = await analyzeMeeting(documentName);

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
