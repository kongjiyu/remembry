import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExtractView } from "./extract-view";
import { notFound } from "next/navigation";
import { getMeetingById } from "@/lib/meetingStorage";

interface MeetingData {
    id: string;
    title: string;
}

async function getMeetingData(id: string): Promise<MeetingData | null> {
    const meeting = await getMeetingById(decodeURIComponent(id));
    if (!meeting) return null;

    return {
        id: meeting.id,
        title: meeting.title,
    };
}

async function getNotes(id: string) {
    const meeting = await getMeetingById(decodeURIComponent(id));
    if (!meeting) return null;

    return meeting.notes_by_language?.[meeting.default_language || "en"] || null;
}

export default async function ExtractPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const meeting = await getMeetingData(id);

    if (!meeting) {
        notFound();
    }

    const notes = await getNotes(id);

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                { label: meeting.title, href: `/meetings/${encodeURIComponent(meeting.id)}` },
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
