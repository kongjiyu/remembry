"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { Upload, Mic, FileAudio, X, Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InputMode = "upload" | "record";

interface AudioFile {
    file: File | Blob;
    name: string;
    size: number;
    duration: number;
    url: string;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function NewMeetingPage() {
    const [inputMode, setInputMode] = useState<InputMode>("upload");
    const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [participants, setParticipants] = useState("");
    const [notes, setNotes] = useState("");

    const acceptedFormats = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/ogg"];

    const handleFileSelect = async (file: File) => {
        if (!acceptedFormats.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
            alert("Please upload an audio file (MP3, WAV, M4A, or WebM)");
            return;
        }

        const url = URL.createObjectURL(file);

        // Get audio duration
        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
            setAudioFile({
                file,
                name: file.name,
                size: file.size,
                duration: Math.floor(audio.duration),
                url,
            });
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleRecordingComplete = (blob: Blob, duration: number) => {
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const fileName = `Recording_${now.toISOString().slice(0, 10)}_${now.toISOString().slice(11, 19).replace(/:/g, "-")}.webm`;

        setAudioFile({
            file: blob,
            name: fileName,
            size: blob.size,
            duration,
            url,
        });
    };

    const handleRemoveAudio = () => {
        if (audioFile) {
            URL.revokeObjectURL(audioFile.url);
        }
        setAudioFile(null);
    };

    const handleSubmit = async () => {
        if (!audioFile) return;

        setIsProcessing(true);

        // TODO: Implement actual upload and processing logic
        // For now, simulate processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsProcessing(false);
        // TODO: Navigate to processing/meeting detail page
    };

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                { label: "New Meeting" }
            ]}
            title="New Meeting"
        >
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                    <Button
                        variant={inputMode === "upload" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setInputMode("upload")}
                        className="gap-2"
                    >
                        <Upload className="size-4" />
                        Upload File
                    </Button>
                    <Button
                        variant={inputMode === "record" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setInputMode("record")}
                        className="gap-2"
                    >
                        <Mic className="size-4" />
                        Record Audio
                    </Button>
                </div>

                {/* Audio Input Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {inputMode === "upload" ? "Upload Recording" : "Record Meeting"}
                        </CardTitle>
                        <CardDescription>
                            {inputMode === "upload"
                                ? "Upload an audio file from your meeting (MP3, WAV, M4A, or WebM)"
                                : "Record your meeting directly from your browser"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {audioFile ? (
                            /* Audio Preview */
                            <div className="border rounded-lg p-4 bg-muted/30">
                                <div className="flex items-center gap-4">
                                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                                        <FileAudio className="size-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{audioFile.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatFileSize(audioFile.size)} · {formatDuration(audioFile.duration)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveAudio}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>

                                {/* Audio Player */}
                                <audio
                                    src={audioFile.url}
                                    controls
                                    className="w-full mt-4 rounded"
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={() => setIsPlaying(false)}
                                />
                            </div>
                        ) : inputMode === "upload" ? (
                            /* Upload Dropzone */
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50"
                                )}
                            >
                                <input
                                    type="file"
                                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    className="hidden"
                                    id="audio-upload"
                                />
                                <label htmlFor="audio-upload" className="cursor-pointer">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                                        <Upload className="size-8 text-primary" />
                                    </div>
                                    <p className="text-lg font-medium mb-1">
                                        Drop your audio file here
                                    </p>
                                    <p className="text-muted-foreground mb-4">
                                        or click to browse
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Supports MP3, WAV, M4A, and WebM (max 500MB)
                                    </p>
                                </label>
                            </div>
                        ) : (
                            /* Audio Recorder */
                            <AudioRecorder onRecordingComplete={handleRecordingComplete} />
                        )}
                    </CardContent>
                </Card>

                {/* Meeting Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Meeting Details</CardTitle>
                        <CardDescription>
                            Add information about your meeting (optional)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="title" className="text-sm font-medium">
                                Meeting Title
                            </label>
                            <Input
                                id="title"
                                placeholder="e.g., Weekly Team Standup"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="participants" className="text-sm font-medium">
                                Participants
                            </label>
                            <Input
                                id="participants"
                                placeholder="e.g., John, Sarah, Mike"
                                value={participants}
                                onChange={(e) => setParticipants(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Separate names with commas for speaker identification
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="notes" className="text-sm font-medium">
                                Additional Notes
                            </label>
                            <Textarea
                                id="notes"
                                placeholder="Any context about the meeting..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                    <Button variant="outline" asChild>
                        <a href="/meetings">Cancel</a>
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!audioFile || isProcessing}
                        className="gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Upload className="size-4" />
                                Start Transcription
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
}
