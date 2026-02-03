import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExtractView } from "./extract-view";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { notFound } from "next/navigation";

interface MeetingData {
    id: string;
    title: string;
}

async function getMeetingData(id: string): Promise<MeetingData | null> {
    const transcriptionPath = path.join(process.cwd(), "uploads", id, "transcription.json");
    if (!existsSync(transcriptionPath)) return null;
    try {
        const data = await readFile(transcriptionPath, "utf-8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function getNotes(id: string) {
    const notesPath = path.join(process.cwd(), "uploads", id, "notes.json");
    if (!existsSync(notesPath)) return null;
    try {
        const data = await readFile(notesPath, "utf-8");
        return JSON.parse(data);
    } catch {
        return null;
    }
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
                { label: meeting.title, href: `/meetings/${id}` },
                { label: "Extract Notes" }
            ]}
            title="Meeting Notes"
        >
            <div className="max-w-5xl mx-auto">
                <ExtractView meetingId={id} initialNotes={notes} />
            </div>
        </DashboardLayout>
    );
}
