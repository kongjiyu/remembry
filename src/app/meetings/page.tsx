"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, Upload, Search, MoreVertical, Clock, CheckCircle2, Loader2, AlertCircle, Calendar, FolderKanban } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Meeting {
    name: string;
    displayName: string;
    uploadTime?: string;
    mimeType?: string;
    projectId?: string;
    projectName?: string;
}

interface Project {
    id: string;
    name: string;
    ragStoreName: string;
    meetings: Meeting[];
    meetingCount: number;
}

interface MeetingWithProject extends Meeting {
    projectId: string;
    projectName: string;
}

function getStatusInfo(status: string) {
    switch (status) {
        case "completed":
            return {
                badge: <Badge className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="size-3" />Synced</Badge>,
                icon: CheckCircle2,
                color: "text-success",
            };
        case "processing":
            return {
                badge: <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><Loader2 className="size-3 animate-spin" />Processing</Badge>,
                icon: Loader2,
                color: "text-primary",
            };
        case "pending_review":
            return {
                badge: <Badge className="bg-warning/10 text-warning border-warning/20 gap-1"><AlertCircle className="size-3" />Review</Badge>,
                icon: AlertCircle,
                color: "text-warning",
            };
        default:
            return {
                badge: <Badge variant="secondary">Unknown</Badge>,
                icon: Clock,
                color: "text-muted-foreground",
            };
    }
}

export default function MeetingsPage() {
    const [meetings, setMeetings] = useState<MeetingWithProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/projects');
            
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const data = await response.json();
            const projects: Project[] = data.projects || [];
            
            // Flatten all meetings from all projects
            const allMeetings: MeetingWithProject[] = [];
            projects.forEach(project => {
                project.meetings.forEach(meeting => {
                    // Skip project-metadata documents
                    if (!meeting.displayName.startsWith('project-')) {
                        allMeetings.push({
                            ...meeting,
                            projectId: project.id,
                            projectName: project.name
                        });
                    }
                });
            });
            
            // Sort by upload time (newest first)
            allMeetings.sort((a, b) => {
                const dateA = a.uploadTime ? new Date(a.uploadTime).getTime() : 0;
                const dateB = b.uploadTime ? new Date(b.uploadTime).getTime() : 0;
                return dateB - dateA;
            });
            
            setMeetings(allMeetings);
        } catch (error) {
            console.error('Error fetching meetings:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMeetings = meetings.filter(meeting =>
        meeting.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown date';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    return (
        <DashboardLayout breadcrumbs={[{ label: "Meetings" }]} title="Meetings">
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search meetings..." 
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button asChild className="gap-2">
                        <Link href="/meetings/new">
                            <Upload className="size-4" />
                            Upload Recording
                        </Link>
                    </Button>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Loading meetings...</p>
                    </div>
                ) : filteredMeetings.length === 0 ? (
                    /* Empty State */
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
                                <Mic className="size-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">
                                {searchQuery ? "No meetings found" : "No meetings yet"}
                            </h3>
                            <p className="text-muted-foreground text-center max-w-sm mb-4">
                                {searchQuery 
                                    ? "Try adjusting your search query"
                                    : "Upload your first meeting recording to get started with AI-powered transcription and note extraction."
                                }
                            </p>
                            {!searchQuery && (
                                <Button asChild>
                                    <Link href="/meetings/new">
                                        <Upload className="size-4 mr-2" />
                                        Upload Recording
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    /* Meetings Grid */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredMeetings.map((meeting, index) => {
                            const statusInfo = getStatusInfo("completed");
                            const encodedDocName = encodeURIComponent(meeting.name);
                            return (
                                <Card key={meeting.name || index} className="group hover:shadow-lg transition-all hover:border-primary/50 relative">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                                    <Mic className="size-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base line-clamp-1">
                                                        {meeting.displayName || 'Untitled Meeting'}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {formatDate(meeting.uploadTime)} · {formatTime(meeting.uploadTime)}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreVertical className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/projects/${meeting.projectId}`}>View Project</Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/meetings/${encodedDocName}?projectId=${meeting.projectId}&projectName=${encodeURIComponent(meeting.projectName)}`}>
                                                            View Transcript
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FolderKanban className="size-3 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground truncate">
                                                {meeting.projectName}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {meeting.mimeType && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {meeting.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                                                    </Badge>
                                                )}
                                            </div>
                                            {statusInfo.badge}
                                        </div>
                                    </CardContent>
                                    <Link 
                                        href={`/meetings/${encodedDocName}?projectId=${meeting.projectId}&projectName=${encodeURIComponent(meeting.projectName)}`} 
                                        className="absolute inset-0"
                                    >
                                        <span className="sr-only">View meeting</span>
                                    </Link>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
