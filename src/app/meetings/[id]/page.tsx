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
    Hash
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
    console.log(`[getMeetingData] Retrieving meeting (raw): ${id}`);
    
    // Decode URL-encoded ID (e.g., %2F -> /)
    const decodedId = decodeURIComponent(id);
    console.log(`[getMeetingData] Decoded ID: ${decodedId}`);
    
    // Try exact match first (local folder)
    let folderId = decodedId;
    let transcriptionPath = path.join(process.cwd(), "uploads", folderId, "transcription.json");
    
    // If exact match doesn't exist, try removing extension (e.g. if ID is "123.mp3", look for folder "123")
    if (!existsSync(transcriptionPath)) {
        console.log(`[Strategy A] Exact match not found: ${transcriptionPath}`);
        
        const idWithoutExt = path.parse(id).name;
        const altPath = path.join(process.cwd(), "uploads", idWithoutExt, "transcription.json");
        if (existsSync(altPath)) {
            console.log(`[Strategy B] ✓ Found with normalized filename: ${idWithoutExt}`);
            folderId = idWithoutExt;
            transcriptionPath = altPath;
        } else {
            console.log(`[Strategy B] Normalized filename not found: ${altPath}`);
            
            // Fallback: Try fetching from RAG store
            console.log(`[Strategy C] Attempting RAG store retrieval...`);
            try {
                const analysis = await analyzeMeeting(decodedId);
                if (analysis) {
                    console.log(`[Strategy C] ✓ Successfully retrieved from RAG store`);
                    
                    // Check if we have a meetingId in customMetadata that points to local storage
                    const localMeetingId = analysis.metadata.customMetadata?.find(
                        (m: any) => m.key === 'meetingId'
                    )?.stringValue;
                    
                    if (localMeetingId) {
                        console.log(`[Strategy C] Found local meetingId in metadata: ${localMeetingId}`);
                        const localPath = path.join(process.cwd(), "uploads", localMeetingId, "transcription.json");
                        
                        if (existsSync(localPath)) {
                            console.log(`[Strategy C] ✓ Redirecting to local storage: ${localMeetingId}`);
                            // Recursively call with the local ID to get full data
                            return getMeetingData(localMeetingId);
                        } else {
                            console.log(`[Strategy C] Local file not found, using RAG data only`);
                        }
                    }
                    
                    // If no local data, return RAG-only data
                    return {
                        id: decodedId,
                        title: analysis.metadata.displayName || decodedId,
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
                console.log(`[Strategy C] RAG store returned no data`);
            } catch (e) {
                console.error("[Strategy C] ✗ Failed to fetch from RAG:", e);
            }
            console.log(`[getMeetingData] All strategies failed - meeting not found`);
            return null;
        }
    } else {
        console.log(`[Strategy A] ✓ Found exact match: ${transcriptionPath}`);
    }

    const notesPath = path.join(process.cwd(), "uploads", folderId, "notes.json");

    try {
        const data = await readFile(transcriptionPath, "utf-8");
        const meeting = JSON.parse(data);

        if (existsSync(notesPath)) {
            const notesData = await readFile(notesPath, "utf-8");
            meeting.notes = JSON.parse(notesData);
            console.log(`[getMeetingData] ✓ Loaded notes from: ${notesPath}`);
        } else {
            console.log(`[getMeetingData] No notes file found (optional)`);
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
    const { projectName, displayName } = await searchParams;
    
    const meeting = await getMeetingData(id);

    if (!meeting) {
        notFound();
    }

    const { transcription, notes } = meeting;

    // Handle potential array or undefined for search params
    const pName = Array.isArray(projectName) ? projectName[0] : projectName; // RAG store resource name
    const pDisplayName = Array.isArray(displayName) ? displayName[0] : displayName; // User-entered project name

    // Calculate actual duration from segments if available, otherwise estimate from text
    const calculateDuration = () => {
        // Try to get duration from last segment's endTime
        if (transcription.segments.length > 0) {
            const lastSegment = transcription.segments[transcription.segments.length - 1];
            if (lastSegment.endTime && lastSegment.endTime > 0) {
                return lastSegment.endTime;
            }
        }
        // If duration is set and valid, use it
        if (transcription.duration > 0) {
            return transcription.duration;
        }
        // Estimate ~150 words per minute for speech, average 5 chars per word
        const estimatedWords = transcription.text.length / 5;
        const estimatedMinutes = estimatedWords / 150;
        return estimatedMinutes * 60; // Return seconds
    };

    // Calculate word count for display
    const wordCount = transcription.text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    const actualDuration = calculateDuration();

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                ...(pName && pDisplayName ? [{ label: pDisplayName, href: `/projects/${encodeURIComponent(pName)}` }] : []),
                { label: meeting.title }
            ]}
            title={meeting.title}
        >
            <div className="space-y-6">
                {/* Back Button */}
                <Button variant="outline" size="sm" asChild>
                    <Link href={pId ? `/projects/${pId}` : "/meetings"}>
                        <ArrowLeft className="size-4 mr-2" />
                        {pId ? "Back to Project" : "Back to Meetings"}
                    </Link>
                </Button>

                {/* Header */}
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
                                    {actualDuration > 0 ? formatDuration(actualDuration) : "—"}
                                </p>
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
                                <p className="text-lg font-semibold">
                                    {wordCount.toLocaleString()}
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
                                    {transcription.segments.length > 0 ? transcription.segments.length : "1"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                                <Hash className="size-5 text-orange-500" />
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
                        <MeetingNotesDisplay 
                            meetingId={id}
                            initialNotes={notes || null}
                            initialLanguage={transcription.language || 'en'}
                        />
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
            </div>
        </DashboardLayout>
    );
}