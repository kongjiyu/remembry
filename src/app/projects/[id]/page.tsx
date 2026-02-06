"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    FolderKanban, 
    Plus, 
    Search, 
    MoreVertical, 
    Mic, 
    Calendar,
    FileText,
    ArrowLeft,
    Upload,
    MessageCircleQuestion,
    Trash2,
    Loader2
} from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Meeting {
    name: string;
    displayName: string;
    uploadTime?: string;
    mimeType?: string;
}

interface Project {
    name: string;          // RAG store resource name - acts as primary key  
    displayName: string;   // User-entered project name
    createdAt: string;
    meetings: Meeting[];
    meetingCount: number;
}

export default function ProjectDetailsPage() {
    const paramsPromise = useParams();
    const router = useRouter();
    
    const [projectName, setProjectName] = useState<string>(''); // RAG store resource name
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const initializeParams = async () => {
            const params = await paramsPromise;
            const id = params.id as string;
            // The URL param is the RAG store resource name (could be URL encoded)
            setProjectName(decodeURIComponent(id));
        };
        initializeParams();
    }, [paramsPromise]);

    useEffect(() => {
        if (projectName) {
            fetchProjectDetails();
        }
    }, [projectName]);

    const fetchProjectDetails = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/projects');
            
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const data = await response.json();
            const foundProject = data.projects?.find((p: Project) => p.name === projectName);
            
            if (foundProject) {
                setProject(foundProject);
            } else {
                console.error('Project not found');
            }
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMeetings = project?.meetings.filter(meeting =>
        meeting.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleDeleteProject = async () => {
        if (!project) return;
        
        try {
            setIsDeleting(true);
            const response = await fetch(`/api/projects/${encodeURIComponent(project.name)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete project');
            }

            // Redirect to projects page after successful deletion
            router.push('/projects');
        } catch (error) {
            console.error('Error deleting project:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete project');
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown date';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Projects", href: "/projects" },
                    { label: "Loading..." }
                ]}
                title="Loading..."
            >
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading project details...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (!project) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Projects", href: "/projects" },
                    { label: "Not Found" }
                ]}
                title="Project Not Found"
            >
                <Card className="py-12">
                    <CardContent className="text-center">
                        <FolderKanban className="size-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Project Not Found</h3>
                        <p className="text-muted-foreground mb-4">
                            The project you're looking for doesn't exist or has been deleted.
                        </p>
                        <Button asChild>
                            <Link href="/projects">
                                <ArrowLeft className="size-4 mr-2" />
                                Back to Projects
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Projects", href: "/projects" },
                { label: project.displayName }
            ]}
            title={project.displayName}
        >
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <Button variant="outline" asChild>
                        <Link href="/projects">
                            <ArrowLeft className="size-4 mr-2" />
                            Back to Projects
                        </Link>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/ask?projectName=${encodeURIComponent(project.name)}&displayName=${encodeURIComponent(project.displayName)}`}>
                                <MessageCircleQuestion className="size-4 mr-2" />
                                Ask Questions
                            </Link>
                        </Button>
                        <Button asChild className="gap-2">
                            <Link href={`/meetings/new?projectName=${encodeURIComponent(project.name)}&displayName=${encodeURIComponent(project.displayName)}`}>
                                <Upload className="size-4" />
                                Upload Meeting
                            </Link>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                                    <Trash2 className="size-4 mr-2" />
                                    Delete Project
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Project Info */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Meetings
                            </CardTitle>
                            <Mic className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{project.meetingCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Uploaded recordings
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Created
                            </CardTitle>
                            <Calendar className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold">
                                {new Date(project.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Project start date
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                RAG Store
                            </CardTitle>
                            <FileText className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-mono truncate">
                                {project.name.split('/').pop()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Store identifier
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Meetings Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-xl font-semibold">Meetings</h2>
                        <div className="flex-1 max-w-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search meetings..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {filteredMeetings.length === 0 ? (
                        <Card className="py-12">
                            <CardContent className="text-center">
                                <Mic className="size-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">
                                    {searchQuery ? "No meetings found" : "No meetings yet"}
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchQuery 
                                        ? "Try adjusting your search query"
                                        : "Upload your first meeting recording to get started"
                                    }
                                </p>
                                {!searchQuery && (
                                    <Button asChild>
                                        <Link href={`/meetings/new?projectName=${encodeURIComponent(project.name)}&displayName=${encodeURIComponent(project.displayName)}`}>
                                            <Plus className="size-4 mr-2" />
                                            Upload Meeting
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {filteredMeetings.map((meeting, index) => {
                                const encodedDocName = encodeURIComponent(meeting.name);
                                return (
                                    <Card key={meeting.name || index} className="group hover:shadow-md transition-shadow relative">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                                        <Mic className="size-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base line-clamp-1">
                                                            {meeting.displayName || 'Untitled Meeting'}
                                                        </CardTitle>
                                                        <CardDescription className="flex items-center gap-2 mt-1">
                                                            <Calendar className="size-3" />
                                                            {formatDate(meeting.uploadTime)}
                                                            {meeting.mimeType && (
                                                                <>
                                                                    <span className="text-muted-foreground">·</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {meeting.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                                                                    </Badge>
                                                                </>
                                                            )}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <MoreVertical className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/meetings/${encodedDocName}?projectName=${encodeURIComponent(project.name)}&displayName=${encodeURIComponent(project.displayName)}`}>
                                                                View Transcript
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/ask?type=meeting&id=${encodeURIComponent(meeting.name)}&name=${encodeURIComponent(meeting.displayName)}&projectName=${encodeURIComponent(project.name)}`}>
                                                                Ask Questions
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>Download</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive">
                                                            Delete Meeting
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <Link 
                                            href={`/meetings/${encodedDocName}?projectName=${encodeURIComponent(project.name)}&displayName=${encodeURIComponent(project.displayName)}`}
                                            className="absolute inset-0"
                                        >
                                            <span className="sr-only">View meeting transcript</span>
                                        </Link>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Project Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{project?.displayName}"? This will permanently delete
                            the project and all {project?.meetingCount} associated meeting(s) from the RAG store. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteProject}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="size-4 mr-2" />
                                    Delete Project
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
