"use client";

import { useState, useEffect } from "react";
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
import { apiFetch } from "@/lib/apiFetch";

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

interface RawTranscription {
    text?: string;
    segments?: TranscriptionSegment[];
    speakers?: string[];
    duration?: number;
    language?: string;
}

interface MeetingData {
    id: string;
    title: string;
    createdAt?: string;
    created_at?: string;
    project_id: string;
    transcription: RawTranscription;
    notes_by_language: Record<string, MeetingNotes>;
    default_language: string;
    available_languages: string[];
}

interface NormalizedTranscription {
    text: string;
    segments: TranscriptionSegment[];
    speakers: string[];
    duration: number;
    language: string;
}

function normalizeTranscription(t: RawTranscription | null | undefined): NormalizedTranscription {
    if (!t) {
        return { text: "", segments: [], speakers: [], duration: 0, language: "en" };
    }
    return {
        text: t.text ?? "",
        segments: Array.isArray(t.segments) ? t.segments : [],
        speakers: Array.isArray(t.speakers) ? t.speakers : [],
        duration: typeof t.duration === "number" ? t.duration : 0,
        language: t.language ?? "en",
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

export default function MeetingDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const [meeting, setMeeting] = useState<MeetingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [id, setId] = useState<string>("");
    const [projectName, setProjectName] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");

    useEffect(() => {
        params.then(({ id }) => setId(id));
        searchParams.then((sp) => {
            const pn = sp.projectName;
            const dn = sp.displayName;
            setProjectName(Array.isArray(pn) ? pn[0] : (pn || ""));
            setDisplayName(Array.isArray(dn) ? dn[0] : (dn || ""));
        });
    }, [params, searchParams]);

    useEffect(() => {
        if (!id) return;

        apiFetch(`/api/meetings/${encodeURIComponent(id)}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch meeting");
                return res.json();
            })
            .then((data) => {
                setMeeting(data.meeting);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <DashboardLayout breadcrumbs={[{ label: "Meetings", href: "/meetings" }, { label: "..." }]} title="Loading...">
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading meeting...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (!meeting) {
        return (
            <DashboardLayout breadcrumbs={[{ label: "Meetings", href: "/meetings" }, { label: "Not Found" }]} title="Not Found">
                <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">Meeting not found</p>
                    <Button variant="outline" className="mt-4" asChild>
                        <Link href="/meetings">Back to Meetings</Link>
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    // Normalize transcription to handle both plain {text} and rich {text,segments,speakers,duration} shapes
    const transcription = normalizeTranscription(meeting.transcription);

    // Handle both createdAt (web) and created_at (Tauri)
    const createdDate = meeting.createdAt ?? meeting.created_at ?? "";

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
                ...(projectName && displayName ? [{ label: displayName, href: `/projects/${encodeURIComponent(projectName)}` }] : []),
                { label: meeting.title },
            ]}
            title={meeting.title}
        >
            <div className="space-y-6">
                <Button variant="outline" size="sm" asChild>
                    <Link href={projectName ? `/projects/${encodeURIComponent(projectName)}` : "/meetings"}>
                        <ArrowLeft className="size-4 mr-2" />
                        {projectName ? "Back to Project" : "Back to Meetings"}
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
                                    {createdDate
                                        ? new Date(createdDate).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })
                                        : "—"}{" "}
                                </span>
                                {displayName && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <FolderKanban className="size-3" />
                                            {displayName}
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
                        <MeetingNotesDisplay
                            meetingId={meeting.id}
                            initialNotes={meeting.notes_by_language?.[transcription.language] ?? null}
                            initialLanguage={transcription.language}
                        />
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

                        {transcription.segments.length > 0 ? (
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
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CheckCircle2 className="size-5 text-green-500" />
                                        Transcript
                                    </CardTitle>
                                    <CardDescription>Full transcription</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{transcription.text}</p>
                                </CardContent>
                            </Card>
                        )}

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