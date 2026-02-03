"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, FileText, Clock, CheckCircle2, AlertCircle, Upload, TrendingUp, FolderKanban, Plus, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";

interface Project {
    id: string;
    name: string;
    ragStoreName: string;
    displayName: string;
    createdAt: string;
    meetings: any[];
    meetingCount: number;
}

// Mock data for demonstration
const recentMeetings = [
    {
        id: "1",
        title: "Weekly Team Standup",
        date: "Jan 18, 2026",
        duration: "45 min",
        status: "completed" as const,
        actionItems: 5,
        decisions: 2,
    },
    {
        id: "2",
        title: "Product Review Q1",
        date: "Jan 17, 2026",
        duration: "1h 15min",
        status: "processing" as const,
        actionItems: 0,
        decisions: 0,
    },
    {
        id: "3",
        title: "Client Kickoff - Project Alpha",
        date: "Jan 15, 2026",
        duration: "2h",
        status: "pending_review" as const,
        actionItems: 8,
        decisions: 4,
    },
];

const recentProjects = [
    {
        id: "1",
        name: "Project Alpha",
        description: "Client kickoff and planning phase",
        meetingCount: 8,
        color: "bg-blue-500",
    },
    {
        id: "2",
        name: "Q1 Product Review",
        description: "Quarterly product assessment",
        meetingCount: 5,
        color: "bg-purple-500",
    },
    {
        id: "3",
        name: "Team Standup Series",
        description: "Regular team sync and updates",
        meetingCount: 24,
        color: "bg-orange-500",
    },
];

const stats = [
    { label: "Total Meetings", value: "24", icon: Mic, change: "+3 this week" },
    { label: "Action Items", value: "47", icon: CheckCircle2, change: "12 completed" },
    { label: "Decisions Logged", value: "31", icon: FileText, change: "+5 this week" },
    { label: "Hours Saved", value: "18h", icon: Clock, change: "This month" },
];

function getStatusBadge(status: string) {
    switch (status) {
        case "completed":
            return <Badge className="bg-success/10 text-success border-success/20">Synced</Badge>;
        case "processing":
            return <Badge className="bg-primary/10 text-primary border-primary/20">Processing</Badge>;
        case "pending_review":
            return <Badge className="bg-warning/10 text-warning border-warning/20">Pending Review</Badge>;
        default:
            return <Badge variant="secondary">Unknown</Badge>;
    }
}

export default function DashboardPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                setProjects(data.projects || []);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get recent projects (top 3)
    const recentProjects = projects.slice(0, 3);
    
    // Calculate stats from real data
    const totalMeetings = projects.reduce((acc, p) => acc + p.meetingCount, 0);

    return (
        <DashboardLayout breadcrumbs={[{ label: "Dashboard" }]} title="Dashboard">
            <div className="space-y-6">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-4">
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/meetings/new">
                            <Upload className="size-5" />
                            Upload Recording
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="gap-2">
                        <Link href="/projects/new">
                            <Plus className="size-5" />
                            Create Project
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="gap-2">
                        <Link href="/meetings">
                            <FileText className="size-5" />
                            View All Meetings
                        </Link>
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Projects
                            </CardTitle>
                            <FolderKanban className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{projects.length}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="size-3" />
                                Active projects
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Meetings
                            </CardTitle>
                            <Mic className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{totalMeetings}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="size-3" />
                                Across all projects
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Avg Meetings
                            </CardTitle>
                            <FileText className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {projects.length > 0 ? Math.round(totalMeetings / projects.length) : 0}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="size-3" />
                                Per project
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                RAG Stores
                            </CardTitle>
                            <CheckCircle2 className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{projects.length}</div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <TrendingUp className="size-3" />
                                Active stores
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Projects */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Recent Projects</CardTitle>
                                <CardDescription>Your active projects and their progress</CardDescription>
                            </div>
                            <Button variant="ghost" asChild>
                                <Link href="/projects">View all</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Loading projects...
                            </div>
                        ) : recentProjects.length === 0 ? (
                            <div className="text-center py-8">
                                <FolderKanban className="size-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground mb-4">No projects yet</p>
                                <Button asChild>
                                    <Link href="/projects/new">Create Your First Project</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        <Link
                                            href={`/projects/${project.id}`}
                                            className="flex items-center gap-4 flex-1"
                                        >
                                            <div className="size-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                                                <FolderKanban className="size-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium">{project.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Created {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right text-sm">
                                                <p className="font-medium">{project.meetingCount} meetings</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                asChild
                                            >
                                                <Link href={`/ask?projectId=${project.id}&projectName=${encodeURIComponent(project.name)}`}>
                                                    <MessageCircleQuestion className="size-4 mr-2" />
                                                    Ask
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Meetings - Using mock data for now */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Recent Meetings</CardTitle>
                                <CardDescription>Your latest recorded meetings and their status</CardDescription>
                            </div>
                            <Button variant="ghost" asChild>
                                <Link href="/meetings">View all</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8">
                            <Mic className="size-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">No recent meetings</p>
                            <Button asChild>
                                <Link href="/meetings/new">Upload Your First Meeting</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Notion Connection Status */}
                <Card className="border-dashed">
                    <CardContent className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                                <AlertCircle className="size-6 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">Connect Notion</h3>
                                <p className="text-sm text-muted-foreground">
                                    Link your Notion workspace to sync meeting notes automatically
                                </p>
                            </div>
                        </div>
                        <Button asChild>
                            <Link href="/settings/notion">Connect</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
