"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExtractView } from "@/components/ui/extract-view";

interface MeetingData {
    id: string;
    title: string;
}

interface NotesData {
    notes: MeetingNotes | null;
    needsRegeneration: boolean;
}

interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
    language?: string;
}

function ExtractContent() {
    const searchParams = useSearchParams();
    const [meeting, setMeeting] = useState<MeetingData | null>(null);
    const [notes, setNotes] = useState<MeetingNotes | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const id = searchParams.get("id") || "";

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            if (!id) {
                if (!cancelled) {
                    setError("Missing meeting id");
                    setLoading(false);
                }
                return;
            }

            try {
                const meetingId = decodeURIComponent(id);

                const [meetingRes, notesRes] = await Promise.all([
                    apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}`),
                    apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/extract`),
                ]);

                if (cancelled) return;

                if (!meetingRes.ok) {
                    throw new Error("Meeting not found");
                }

                const meetingDataWrapper = await meetingRes.json() as { meeting: MeetingData };
                const notesData = await notesRes.json() as NotesData;

                setMeeting(meetingDataWrapper.meeting);
                setNotes(notesData.notes ?? null);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Failed to load meeting");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadData();
        return () => { cancelled = true; };
    }, [id]);

    if (loading) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Meetings", href: "/meetings" },
                    { label: "Loading..." }
                ]}
                title="Meeting Notes"
            >
                <div className="max-w-5xl mx-auto flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !meeting) {
        return (
            <DashboardLayout
                breadcrumbs={[
                    { label: "Meetings", href: "/meetings" }
                ]}
                title="Meeting Notes"
            >
                <div className="max-w-5xl mx-auto flex items-center justify-center h-64">
                    <div className="text-destructive">{error || "Meeting not found"}</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                { label: meeting.title, href: `/meetings/detail?id=${encodeURIComponent(meeting.id)}` },
                { label: "Extract Notes" }
            ]}
            title="Meeting Notes"
        >
            <div className="max-w-5xl mx-auto">
                <ExtractView meetingId={meeting.id} initialNotes={notes} />
            </div>
        </DashboardLayout>
    );
}

export default function ExtractPage() {
    return (
        <Suspense fallback={<div className="max-w-5xl mx-auto flex items-center justify-center h-64"><div className="text-muted-foreground">Loading...</div></div>}>
            <ExtractContent />
        </Suspense>
    );
}