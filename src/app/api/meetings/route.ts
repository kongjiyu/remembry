import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

interface MeetingWithProject {
    id: string;
    title: string;
    project_id: string;
    projectName: string;
    projectDisplayName: string;
    uploadTime?: string;
    mimeType?: string;
}

export async function GET() {
    try {
        const supabase = getSupabaseServerClient();

        // Fetch meetings with project info
        const { data: meetings, error } = await supabase
            .from("meetings")
            .select(`
                id,
                project_id,
                title,
                created_at,
                mime_type,
                file_type
            `)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        // Fetch projects to get display names
        const { data: projects } = await supabase
            .from("projects")
            .select("id, display_name");

        const projectMap = new Map(
            (projects || []).map(p => [p.id, p.display_name])
        );

        // Combine meetings with project info
        const combinedMeetings: MeetingWithProject[] = (meetings || []).map(m => ({
            id: m.id,
            name: m.id,
            title: m.title,
            displayName: m.title,
            project_id: m.project_id,
            projectName: m.project_id,
            projectDisplayName: projectMap.get(m.project_id) || "Unknown Project",
            uploadTime: m.created_at,
            mimeType: m.mime_type,
        }));

        return NextResponse.json({
            success: true,
            meetings: combinedMeetings,
            count: combinedMeetings.length,
        });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch meetings' },
            { status: 500 }
        );
    }
}