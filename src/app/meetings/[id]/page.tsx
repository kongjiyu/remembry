import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Mic, 
    Clock, 
    Users, 
    FileText, 
    Download, 
    Share2, 
    CheckCircle2,
    MessageSquare,
    ChevronRight,
    ListTodo,
    Gavel,
    Lightbulb,
    Hash,
    HelpCircle,
    ArrowLeft,
    FolderKanban
} from "lucide-react";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeMeeting } from "@/lib/fileSearch";

interface TranscriptionSegment {
    speaker: string;
    text: string;
    startTime?: number;
    endTime?: number;
}

interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
}

interface MeetingData {
    id: string;
    title: string;
    participants: string[];
    createdAt: string;
    status: string;
    transcription: {
        text: string;
        segments: TranscriptionSegment[];
        speakers: string[];
        duration: number;
        language?: string;
        debug?: {
            prompt: string;
            response: string;
        };
    };
    audioPath: string;
    notes?: MeetingNotes;
}

async function getMeetingData(id: string): Promise<MeetingData | null> {
    // Try exact match first (local folder)
    let folderId = id;
    let transcriptionPath = path.join(process.cwd(), "uploads", folderId, "transcription.json");
    
    // If exact match doesn't exist, try removing extension (e.g. if ID is "123.mp3", look for folder "123")
    if (!existsSync(transcriptionPath)) {
        const idWithoutExt = path.parse(id).name;
        const altPath = path.join(process.cwd(), "uploads", idWithoutExt, "transcription.json");
        if (existsSync(altPath)) {
            folderId = idWithoutExt;
            transcriptionPath = altPath;
        } else {
            // Fallback: Try fetching from RAG store
            try {
                const analysis = await analyzeMeeting(id);
                if (analysis) {
                    return {
                        id: id,
                        title: analysis.metadata.displayName || id,
                        participants: [],
                        createdAt: analysis.metadata.createTime || new Date().toISOString(),
                        status: "completed",
                        audioPath: "", // No local audio
                        transcription: {
                            text: "Transcript available in RAG Store (not locally cached).",
                            segments: [],
                            speakers: [],
                            duration: 0,
                            language: "en"
                        },
                        notes: {
                            summary: analysis.summary,
                            keyTopics: [],
                            actionItems: analysis.actionItems,
                            decisions: [],
                            assumptions: [],
                            qa: []
                        }
                    };
                }
            } catch (e) {
                console.error("Failed to fetch from RAG:", e);
            }
            return null;
        }
    }

    const notesPath = path.join(process.cwd(), "uploads", folderId, "notes.json");

    try {
        const data = await readFile(transcriptionPath, "utf-8");
        const meeting = JSON.parse(data);

        if (existsSync(notesPath)) {
            const notesData = await readFile(notesPath, "utf-8");
            meeting.notes = JSON.parse(notesData);
        }

        return meeting;
    } catch {
        return null;
    }
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
}

function formatTimestamp(seconds?: number): string {
    if (seconds === undefined) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default async function MeetingDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const { projectId, projectName } = await searchParams;
    
    const meeting = await getMeetingData(id);

    if (!meeting) {
        notFound();
    }

    const { transcription, notes } = meeting;

    // Handle potential array or undefined for search params
    const pId = Array.isArray(projectId) ? projectId[0] : projectId;
    const pName = Array.isArray(projectName) ? projectName[0] : projectName;

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                ...(pId && pName ? [{ label: pName, href: `/projects/${pId}` }] : []),
                { label: meeting.title }
            ]}
            title={meeting.title}
        >
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" asChild className="shrink-0">
                            <Link href={pId ? `/projects/${pId}` : "/meetings"}>
                                <ArrowLeft className="size-4 mr-2" />
                                {pId ? "Back to Project" : "Back to Meetings"}
                            </Link>
                        </Button>
                        <div className="flex items-center gap-4">
                            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                <Mic className="size-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold line-clamp-1">{meeting.title}</h1>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <span>
                                        {new Date(meeting.createdAt).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </span>
                                    {pName && (
                                        <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <FolderKanban className="size-3" />
                                                {pName}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Download className="size-4" />
                            Export
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Share2 className="size-4" />
                            Share
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                                <Clock className="size-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Duration</p>
                                <p className="text-lg font-semibold">
                                    {formatDuration(transcription.duration)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                                <Users className="size-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Speakers</p>
                                <p className="text-lg font-semibold">
                                    {transcription.speakers.length}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <MessageSquare className="size-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Segments</p>
                                <p className="text-lg font-semibold">
                                    {transcription.segments.length}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                                <FileText className="size-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Language</p>
                                <p className="text-lg font-semibold uppercase">
                                    {transcription.language || "EN"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="notes" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="notes" className="gap-2">
                            <FileText className="size-4" />
                            Meeting Notes
                        </TabsTrigger>
                        <TabsTrigger value="transcript" className="gap-2">
                            <CheckCircle2 className="size-4" />
                            Transcript
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="notes" className="space-y-6">
                        {notes ? (
                            <>
                                {/* Summary */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="size-5 text-blue-500" />
                                            Executive Summary
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            <p className="whitespace-pre-wrap leading-relaxed">{notes.summary}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Key Topics */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Hash className="size-5 text-indigo-500" />
                                                Key Topics
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {notes.keyTopics && notes.keyTopics.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {notes.keyTopics.map((item, i) => (
                                                        <li key={i} className="flex gap-3 text-sm">
                                                            <div className="mt-1 size-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No key topics detected.</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Action Items */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <ListTodo className="size-5 text-green-500" />
                                                Action Items
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {notes.actionItems && notes.actionItems.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {notes.actionItems.map((item, i) => (
                                                        <li key={i} className="flex gap-3 text-sm">
                                                            <div className="mt-1 size-1.5 rounded-full bg-green-500 shrink-0" />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No action items detected.</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Decisions */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Gavel className="size-5 text-orange-500" />
                                                Key Decisions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {notes.decisions && notes.decisions.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {notes.decisions.map((item, i) => (
                                                        <li key={i} className="flex gap-3 text-sm">
                                                            <div className="mt-1 size-1.5 rounded-full bg-orange-500 shrink-0" />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No decisions detected.</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Assumptions */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Lightbulb className="size-5 text-yellow-500" />
                                                Assumptions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {notes.assumptions && notes.assumptions.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {notes.assumptions.map((item, i) => (
                                                        <li key={i} className="flex gap-3 text-sm">
                                                            <div className="mt-1 size-1.5 rounded-full bg-yellow-500 shrink-0" />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No assumptions detected.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Q&A */}
                                {notes.qa && notes.qa.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <HelpCircle className="size-5 text-purple-500" />
                                                Q&A
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {notes.qa.map((qa, i) => (
                                                    <div key={i} className="space-y-1">
                                                        <p className="font-medium text-sm text-primary">Q: {qa.question}</p>
                                                        <p className="text-sm text-muted-foreground">A: {qa.answer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        ) : (
                             <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                                        <FileText className="size-8 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium">No Notes Generated Yet</h3>
                                        <p className="text-muted-foreground max-w-sm mx-auto">
                                            The notes for this meeting haven't been generated or are currently processing.
                                        </p>
                                    </div>
                                    <Button asChild>
                                        <Link href={`/meetings/${id}/extract`}>
                                            Generate Notes
                                            <ChevronRight className="size-4 ml-1" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="transcript" className="space-y-6">
                        {/* Speakers */}
                        {transcription.speakers.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Speakers Identified</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {transcription.speakers.map((speaker, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-sm py-1 px-3">
                                                {speaker}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Transcript */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle2 className="size-5 text-green-500" />
                                    Transcript
                                </CardTitle>
                                <CardDescription>
                                    Full transcription with speaker identification
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-150 overflow-y-auto pr-4">
                                    {transcription.segments.map((segment, idx) => (
                                        <div key={idx} className="flex gap-4 group">
                                            {segment.startTime !== undefined && (
                                                <span className="text-xs text-muted-foreground font-mono w-12 shrink-0 pt-1">
                                                    {formatTimestamp(segment.startTime)}
                                                </span>
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-sm text-primary">
                                                        {segment.speaker}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-foreground leading-relaxed">
                                                    {segment.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Full Text (Collapsed) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Full Text</CardTitle>
                                <CardDescription>
                                    Plain text version without speaker labels
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {transcription.text}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Debug Info */}
                {transcription.debug && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Debug Info</CardTitle>
                            <CardDescription>
                                API Request and Response Details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2">Request Prompt</h4>
                                <div className="bg-muted p-4 rounded-md overflow-x-auto">
                                    <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {transcription.debug.prompt}
                                    </pre>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Raw Response</h4>
                                <div className="bg-muted p-4 rounded-md overflow-x-auto">
                                    <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {transcription.debug.response}
                                    </pre>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}