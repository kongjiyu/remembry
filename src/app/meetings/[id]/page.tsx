import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingNotesDisplay } from "@/components/ui/meeting-notes-display";
import {
    Mic,
    Clock,
    FileText,
    Download,
    Share2,
    CheckCircle2,
    MessageSquare,
    ArrowLeft,
    FolderKanban,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeetingById } from "@/lib/meetingStorage";

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
    const meeting = await getMeetingById(decodeURIComponent(id));
    if (!meeting) {
        return null;
    }

    return {
        id: meeting.id,
        title: meeting.title,
        participants: [],
        createdAt: meeting.created_at,
        status: "completed",
        audioPath: "",
        transcription: meeting.transcription,
        notes: meeting.notes_by_language?.[meeting.default_language || "en"],
    };
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
    const { projectName, displayName } = await searchParams;

    const meeting = await getMeetingData(id);

    if (!meeting) {
        notFound();
    }

    const { transcription, notes } = meeting;

    const pName = Array.isArray(projectName) ? projectName[0] : projectName;
    const pDisplayName = Array.isArray(displayName) ? displayName[0] : displayName;

    const calculateDuration = () => {
        if (transcription.segments.length > 0) {
            const lastSegment = transcription.segments[transcription.segments.length - 1];
            if (lastSegment.endTime && lastSegment.endTime > 0) {
                return lastSegment.endTime;
            }
        }
        if (transcription.duration > 0) {
            return transcription.duration;
        }
        const estimatedWords = transcription.text.length / 5;
        const estimatedMinutes = estimatedWords / 150;
        return estimatedMinutes * 60;
    };

    const wordCount = transcription.text.trim().split(/\s+/).filter((w) => w.length > 0).length;
    const actualDuration = calculateDuration();

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                ...(pName && pDisplayName ? [{ label: pDisplayName, href: `/projects/${encodeURIComponent(pName)}` }] : []),
                { label: meeting.title },
            ]}
            title={meeting.title}
        >
            <div className="space-y-6">
                <Button variant="outline" size="sm" asChild>
                    <Link href={pName ? `/projects/${encodeURIComponent(pName)}` : "/meetings"}>
                        <ArrowLeft className="size-4 mr-2" />
                        {pName ? "Back to Project" : "Back to Meetings"}
                    </Link>
                </Button>

                <div className="flex flex-col sm:flex-row gap-4 justify-between">
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
                                {pDisplayName && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <FolderKanban className="size-3" />
                                            {pDisplayName}
                                        </span>
                                    </>
                                )}
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

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                                <Clock className="size-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Duration</p>
                                <p className="text-lg font-semibold">{actualDuration > 0 ? formatDuration(actualDuration) : "—"}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                                <FileText className="size-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Words</p>
                                <p className="text-lg font-semibold">{wordCount.toLocaleString()}</p>
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
                                <p className="text-lg font-semibold">{transcription.segments.length > 0 ? transcription.segments.length : "1"}</p>
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
                        <MeetingNotesDisplay meetingId={meeting.id} initialNotes={notes || null} initialLanguage={transcription.language || "en"} />
                    </TabsContent>

                    <TabsContent value="transcript" className="space-y-6">
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

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle2 className="size-5 text-green-500" />
                                    Transcript
                                </CardTitle>
                                <CardDescription>Full transcription with speaker identification</CardDescription>
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
                                                    <span className="font-medium text-sm text-primary">{segment.speaker}</span>
                                                </div>
                                                <p className="text-sm text-foreground leading-relaxed">{segment.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Full Text</CardTitle>
                                <CardDescription>Plain text version without speaker labels</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{transcription.text}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
