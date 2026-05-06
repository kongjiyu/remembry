import { getSupabaseServerClient } from "@/lib/supabase";

export interface TranscriptionSegment {
    speaker: string;
    text: string;
    startTime?: number;
    endTime?: number;
}

export interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
    language?: string;
}

export interface StoredMeeting {
    id: string;
    project_id: string;
    title: string;
    context: string | null;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    file_type: string;
    created_at: string;
    transcription: {
        text: string;
        segments: TranscriptionSegment[];
        speakers: string[];
        duration: number;
        language?: string;
    };
    notes_by_language: Record<string, MeetingNotes>;
    default_language: string;
    available_languages: string[];
}

export async function upsertMeeting(meeting: StoredMeeting): Promise<void> {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("meetings").upsert(meeting, {
        onConflict: "id",
    });

    if (error) {
        throw new Error(`Failed to store meeting: ${error.message}`);
    }
}

export async function getMeetingById(meetingId: string): Promise<StoredMeeting | null> {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
        .from("meetings")
        .select("id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages")
        .eq("id", meetingId)
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to fetch meeting: ${error.message}`);
    }

    return (data as StoredMeeting | null) || null;
}

export async function getMeetingMetadata(meetingId: string): Promise<{ availableLanguages: string[]; defaultLanguage: string; createdAt: string | null } | null> {
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
        return null;
    }

    return {
        availableLanguages: meeting.available_languages || [meeting.default_language || "en"],
        defaultLanguage: meeting.default_language || "en",
        createdAt: meeting.created_at || null,
    };
}

export async function getMeetingNotes(meetingId: string, language: string): Promise<{ notes: MeetingNotes | null; needsRegeneration: boolean }> {
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
        throw new Error("Meeting not found");
    }

    const notesMap = meeting.notes_by_language || {};
    const notes = notesMap[language] || null;

    return {
        notes,
        needsRegeneration: !notes,
    };
}

export async function updateMeetingNotesLanguage(meetingId: string, language: string, notes: MeetingNotes): Promise<void> {
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
        throw new Error("Meeting not found");
    }

    const notesByLanguage = {
        ...(meeting.notes_by_language || {}),
        [language]: notes,
    };

    const currentLanguages = meeting.available_languages || [];
    const availableLanguages = currentLanguages.includes(language)
        ? currentLanguages
        : [...currentLanguages, language];

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
        .from("meetings")
        .update({
            notes_by_language: notesByLanguage,
            available_languages: availableLanguages,
        })
        .eq("id", meetingId);

    if (error) {
        throw new Error(`Failed to update meeting notes: ${error.message}`);
    }
}
