"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Mic, 
    ArrowLeft,
    Calendar,
    FileText,
    FolderKanban,
    Loader2,
    Download,
    MessageCircleQuestion
} from "lucide-react";
import Link from "next/link";

interface DocumentMetadata {
    displayName: string;
    mimeType?: string;
    createTime?: string;
    customMetadata?: Array<{
        key?: string;
        stringValue?: string;
    }>;
}

interface MeetingAnalysis {
    summary: string;
    actionItems: string[];
    metadata: DocumentMetadata;
}

export default function MeetingDetailsPage() {
    const paramsPromise = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const [documentName, setDocumentName] = useState<string>('');
    const [meetingAnalysis, setMeetingAnalysis] = useState<MeetingAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get project info from URL params if available
    const projectId = searchParams.get('projectId');
    const projectName = searchParams.get('projectName');

    useEffect(() => {
        const initializeParams = async () => {
            const params = await paramsPromise;
            const docName = params.documentName as string;
            setDocumentName(docName);
        };
        initializeParams();
    }, [paramsPromise]);

    useEffect(() => {
        if (documentName) {
            fetchDocumentDetails();
        }
    }, [documentName]);

    const fetchDocumentDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/meetings/analyze?documentName=${encodeURIComponent(documentName)}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to analyze meeting');
            }

            const data = await response.json();
            
            if (!data.meeting) {
                throw new Error('No meeting analysis received');
            }
            
            setMeetingAnalysis(data.meeting);
        } catch (error) {
            console.error('Error analyzing meeting:', error);
            setError(error instanceof Error ? error.message : 'Failed to analyze meeting');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown date';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Extract project info from metadata if not in URL params
    const getProjectInfo = () => {
        if (projectId && projectName) {
            return { id: projectId, name: projectName };
        }
        
        const projectMeta = meetingAnalysis?.metadata.customMetadata?.find(m => m.key === 'project');
        const projectNameMeta = meetingAnalysis?.metadata.customMetadata?.find(m => m.key === 'projectName');
        
        return {
            id: projectMeta?.stringValue,
            name: projectNameMeta?.stringValue
        };
    };

    const project = getProjectInfo();

    if (loading) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Meetings", href: "/meetings" },
                    { label: "Loading..." }
                ]}
                title="Loading..."
            >
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
            </DashboardLayout>
        );
    }

    if (error || !meetingAnalysis) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Meetings", href: "/meetings" },
                    { label: "Error" }
                ]}
                title="Meeting Not Found"
            >
                <Card className="py-12">
                    <CardContent className="text-center">
                        <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Meeting Not Found</h3>
                        <p className="text-muted-foreground mb-4">
                            {error || "The meeting document you're looking for doesn't exist or couldn't be loaded."}
                        </p>
                        <Button asChild>
                            <Link href="/meetings">
                                <ArrowLeft className="size-4 mr-2" />
                                Back to Meetings
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
                { label: "Meetings", href: "/meetings" },
                ...(project.id && project.name ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
                { label: meetingAnalysis.metadata.displayName || "Meeting" }
            ]}
            title={meetingAnalysis.metadata.displayName || "Meeting Details"}
        >
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <Button variant="outline" asChild>
                        <Link href={project.id ? `/projects/${project.id}` : "/meetings"}>
                            <ArrowLeft className="size-4 mr-2" />
                            {project.id ? `Back to ${project.name}` : "Back to Meetings"}
                        </Link>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline">
                            <Download className="size-4 mr-2" />
                            Download
                        </Button>
                    </div>
                </div>

                {/* Meeting Info */}
                <div className="grid gap-4 md:grid-cols-3">
                    {project.id && project.name && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Project
                                </CardTitle>
                                <FolderKanban className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <Link href={`/projects/${project.id}`} className="text-lg font-semibold hover:underline">
                                    {project.name}
                                </Link>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Click to view project
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Uploaded
                            </CardTitle>
                            <Calendar className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-semibold">
                                {formatDate(meetingAnalysis.metadata.createTime)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Document creation date
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                File Type
                            </CardTitle>
                            <FileText className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <Badge variant="outline" className="text-sm">
                                {meetingAnalysis.metadata.mimeType?.split('/')[1]?.toUpperCase() || 'TEXT'}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                                {meetingAnalysis.metadata.mimeType || 'text/plain'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Analysis Section */}
                <div className="space-y-6">
                    {/* Summary */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="size-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold">Meeting Summary</h2>
                                <p className="text-sm text-muted-foreground">
                                    AI-generated overview of the meeting
                                </p>
                            </div>
                        </div>
                        
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {meetingAnalysis.summary}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Items */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                <Mic className="size-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold">Action Items</h2>
                                <p className="text-sm text-muted-foreground">
                                    Key tasks and next steps identified
                                </p>
                            </div>
                        </div>
                        
                        <Card>
                            <CardContent className="pt-6">
                                {meetingAnalysis.actionItems.length > 0 && meetingAnalysis.actionItems[0] !== "No action items identified" ? (
                                    <ul className="space-y-3">
                                        {meetingAnalysis.actionItems.map((item, index) => (
                                            <li key={index} className="flex items-start gap-3">
                                                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary mt-0.5">
                                                    {index + 1}
                                                </span>
                                                <span className="flex-1 text-sm leading-relaxed">
                                                    {item}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No action items identified in this meeting.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
