import { NextRequest, NextResponse } from 'next/server';
import { initialize, getProjectRagStore, listAllProjects } from '@/lib/fileSearch';

// Initialize AI on module load
initialize();

export async function GET(request: NextRequest) {
    try {
        // Fetch all projects from RAG file search stores
        const projects = await listAllProjects();

        return NextResponse.json({
            success: true,
            projects,
            count: projects.length,
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, color, goals } = body;

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // Create a dedicated RAG store for this project
        // The displayName is the user-entered project name
        // The API will return the unique resource name (e.g., fileSearchStores/abc-123)
        let projectName: string;
        try {
            projectName = await getProjectRagStore(undefined, name.trim(), color);
        } catch (error) {
            console.error('Failed to create RAG store for project:', error);
            return NextResponse.json(
                { error: 'Failed to create RAG store for project' },
                { status: 500 }
            );
        }

        // Create project data
        const project = {
            name: projectName,  // RAG store resource name (the unique identifier)
            displayName: name.trim(),  // User-entered project name
            description: description?.trim() || '',
            color: color || 'bg-blue-500',
            goals: goals?.trim() || '',
            createdAt: new Date().toISOString(),
        };

        return NextResponse.json({
            success: true,
            project,
            message: 'Project created successfully with dedicated RAG store.',
        });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}
