"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { Upload, Mic, FileAudio, FileText, X, Loader2, FolderKanban, Plus, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/apiFetch";
import { invoke } from "@tauri-apps/api/core";
import Link from "next/link";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Project {
    id: string;
    display_name: string;
    color: string;
    description: string;
    goals: string;
    created_at: string;
    meeting_count?: number;
}

type InputMode = "upload" | "record";
type FileType = "audio" | "text";

interface UploadedFile {
    file: File | Blob;
    name: string;
    size: number;
    duration?: number;
    url?: string;
    fileType: FileType;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || isNaN(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Child component that uses useSearchParams - must be wrapped in Suspense
function ModeParamHandler({ onModeChange, onQuickRecordEntry }: { onModeChange: (mode: InputMode) => void; onQuickRecordEntry: () => void }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const mode = searchParams.get("mode");
        if (mode === "record") {
            onModeChange("record");
            onQuickRecordEntry();
        }
    }, [searchParams, onModeChange, onQuickRecordEntry]);

    return null;
}

export default function NewMeetingPage() {
    const router = useRouter();
    const [inputMode, setInputMode] = useState<InputMode>("upload");
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>("");

    // Form state
    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");

    // Project selection
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
    // Track if this was triggered by quick-record URL (only auto-start from URL, not tab click)
    const [isQuickRecordEntry, setIsQuickRecordEntry] = useState(false);
    // Confirmation dialog state for unsaved recording
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [pendingMode, setPendingMode] = useState<InputMode | null>(null);
    const [hasUnsavedRecording, setHasUnsavedRecording] = useState(false);

    // Stabilized callbacks for ModeParamHandler to prevent re-forcing record mode
    const handleModeChange = useCallback((mode: InputMode) => {
        setInputMode(mode);
    }, []);
    const handleQuickRecordEntry = useCallback(() => {
        setIsQuickRecordEntry(true);
    }, []);

    // Guarded mode change: shows dialog if switching from record→upload with unsaved audio
    const requestModeChange = useCallback((newMode: InputMode) => {
        if (newMode === "upload" && inputMode === "record" && hasUnsavedRecording) {
            setPendingMode("upload");
            setShowDiscardDialog(true);
            return;
        }
        if (newMode === "record") {
            setIsQuickRecordEntry(false); // clear auto-start flag on manual switch
        }
        setInputMode(newMode);
    }, [inputMode, hasUnsavedRecording]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await apiFetch('/api/projects');
                if (response.ok) {
                    const data = await response.json();
                    setProjects(data.projects || []);
                    if (data.projects.length > 0) {
                        setSelectedProject(data.projects[0]);
                    }
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            } finally {
                setLoadingProjects(false);
            }
        };

        fetchProjects();
    }, []);

    // Auto-submit effect for recordings
    useEffect(() => {
        if (shouldAutoSubmit && uploadedFile && selectedProject) {
            handleSubmit();
            setShouldAutoSubmit(false);
        }
    }, [shouldAutoSubmit, uploadedFile, selectedProject]);

    const acceptedAudioFormats = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/ogg", "video/webm", "audio/mp4", "video/mp4"];
    const acceptedTextFormats = ["text/plain"];

    const handleFileSelect = async (file: File) => {
        // Check if it's a text file
        if (file.type === "text/plain" || file.name.match(/\.txt$/i)) {
            setUploadedFile({
                file,
                name: file.name,
                size: file.size,
                fileType: "text",
            });
            return;
        }

        // Check if it's an audio/video file (WebM/MP4 may be reported as video)
        if (!acceptedAudioFormats.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|webm|ogg|mp4)$/i)) {
            toast.error("Please upload an audio file (MP3, WAV, M4A, WebM, MP4) or text transcript (TXT)");
            return;
        }

        const url = URL.createObjectURL(file);

        // Get audio duration
        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
            const duration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : undefined;
            setUploadedFile({
                file,
                name: file.name,
                size: file.size,
                duration: duration,
                url,
                fileType: "audio",
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

        setUploadedFile({
            file: blob,
            name: fileName,
            size: blob.size,
            duration,
            url,
            fileType: "audio",
        });
        setShouldAutoSubmit(true);
    };

    const handleRemoveFile = () => {
        if (uploadedFile?.url) {
            URL.revokeObjectURL(uploadedFile.url);
        }
        setUploadedFile(null);
        setShouldAutoSubmit(false);
    };

    const handleSubmit = useCallback(async () => {
        if (!uploadedFile || !selectedProject) {
            toast.error('Please select a project');
            return;
        }

        setIsProcessing(true);
        setProcessingStatus("Preparing file...");

        try {
            // Check if Gemini API key is configured first
            const keyStatus = await invoke<{ hasKey: boolean }>('get_gemini_key_status');
            if (!keyStatus.hasKey) {
                toast.error('Gemini API key not configured. Please add your API key in Settings.');
                return;
            }

            const file = uploadedFile.file;
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const fileName = title || uploadedFile.name;
            const mimeType = file.type || (uploadedFile.fileType === 'text' ? 'text/plain' : 'audio/mpeg');

            setProcessingStatus("Starting upload...");

            // Start upload session using invoke directly
            const startResult = await invoke<{ success: boolean; upload_id: string }>('start_upload', {
                fileName,
                totalChunks,
            });

            if (!startResult.success) {
                throw new Error('Failed to start upload');
            }

            const uploadId = startResult.upload_id;

            setProcessingStatus(`Uploading ${totalChunks} chunk(s)...`);

            // Upload chunks
            const arrayBuffer = await file.arrayBuffer();
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = arrayBuffer.slice(start, end);
                const base64Chunk = btoa(
                    new Uint8Array(chunk).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );

                const chunkResult = await invoke<{ success: boolean }>('append_upload_chunk', {
                    uploadId,
                    chunkIndex: i,
                    chunkData: base64Chunk,
                });

                if (!chunkResult.success) {
                    await invoke('cancel_upload', { uploadId });
                    throw new Error('Failed to upload chunk');
                }

                setProcessingStatus(`Uploading chunk ${i + 1} of ${totalChunks}...`);
            }

            setProcessingStatus("Processing meeting...");

            // Process the upload using invoke directly
            const processResult = await invoke<{
                success: boolean;
                meeting_id: string;
                meeting: unknown;
                message: string;
            }>('process_meeting_upload', {
                uploadId,
                params: {
                    project_id: selectedProject.id,
                    title: fileName,
                    context: notes || null,
                    file_type: uploadedFile.fileType,
                    notes_languages: ["en"],
                },
            });

            if (!processResult.success) {
                throw new Error(processResult.message || 'Failed to process meeting');
            }

            console.log('Meeting uploaded successfully:', processResult);

            toast.success("Meeting uploaded successfully!");

            if (processResult.meeting_id) {
                const queryParams = new URLSearchParams({
                    projectName: selectedProject.id,
                    display_name: selectedProject.display_name
                });
                router.push(`/meetings/${processResult.meeting_id}?${queryParams.toString()}`);
            } else {
                router.push('/meetings');
            }
        } catch (error) {
            console.error('Error uploading meeting:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload meeting');
        } finally {
            setIsProcessing(false);
        }
    }, [uploadedFile, selectedProject, title, notes, router]);

    // Auto-submit effect for recordings
    useEffect(() => {
        if (shouldAutoSubmit && uploadedFile && selectedProject) {
            handleSubmit();
            setShouldAutoSubmit(false);
        }
    }, [shouldAutoSubmit, uploadedFile, selectedProject, handleSubmit]);

    // Only auto-start when coming from quick-record URL, not from manual tab switch
    const shouldAutoStart = inputMode === "record" && isQuickRecordEntry;

    return (
        <DashboardLayout
            breadcrumbs={[
                { label: "Meetings", href: "/meetings" },
                { label: "New Meeting" }
            ]}
            title="New Meeting"
        >
            <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
                <ModeParamHandler onModeChange={handleModeChange} onQuickRecordEntry={handleQuickRecordEntry} />
            </Suspense>
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                    <Button
                        variant={inputMode === "upload" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => requestModeChange("upload")}
                        className="gap-2"
                    >
                        <Upload className="size-4" />
                        Upload File
                    </Button>
                    <Button
                        variant={inputMode === "record" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => requestModeChange("record")}
                        className="gap-2"
                    >
                        <Mic className="size-4" />
                        Record Audio
                    </Button>
                </div>

                {/* Audio/Text Input Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {inputMode === "upload" ? "Upload Recording or Transcript" : "Record Meeting"}
                        </CardTitle>
                        <CardDescription>
                            {inputMode === "upload"
                                ? "Upload an audio file (MP3, WAV, M4A, WebM) or text transcript (TXT)"
                                : "Record your meeting directly from your browser"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {uploadedFile ? (
                            /* File Preview */
                            <div className="border rounded-lg p-4 bg-muted/30">
                                <div className="flex items-center gap-4">
                                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                                        {uploadedFile.fileType === "text" ? (
                                            <FileText className="size-6 text-primary" />
                                        ) : (
                                            <FileAudio className="size-6 text-primary" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{uploadedFile.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatFileSize(uploadedFile.size)}
                                            {uploadedFile.duration && ` · ${formatDuration(uploadedFile.duration)}`}
                                            {uploadedFile.fileType === "text" && " · Text Transcript"}
                                        </p>
                                    </div>
                                    {uploadedFile.url && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                            className="text-muted-foreground hover:text-primary"
                                        >
                                            <a href={uploadedFile.url} download={uploadedFile.name}>
                                                <Download className="size-4" />
                                            </a>
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveFile}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>

                                {/* Audio Player - only show for audio files */}
                                {uploadedFile.fileType === "audio" && uploadedFile.url && (
                                    <audio
                                        src={uploadedFile.url}
                                        controls
                                        className="w-full mt-4 rounded"
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                    />
                                )}
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
                                    accept="audio/*,video/webm,video/mp4,text/plain,.mp3,.wav,.m4a,.webm,.ogg,.mp4,.txt"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                                        <Upload className="size-8 text-primary" />
                                    </div>
                                    <p className="text-lg font-medium mb-1">
                                        Drop your file here
                                    </p>
                                    <p className="text-muted-foreground mb-4">
                                        or click to browse
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Audio: MP3, WAV, M4A, WebM (max 500MB)<br/>
                                        Text: TXT transcript files
                                    </p>
                                </label>
                            </div>
                        ) : (
                            /* Audio Recorder */
                            <AudioRecorder onRecordingComplete={handleRecordingComplete} autoStart={shouldAutoStart} onUnsavedRecordingChange={setHasUnsavedRecording} />
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
                        {/* Project Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Project <span className="text-destructive">*</span>
                            </label>
                            <div className="flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="flex-1 justify-between overflow-hidden min-w-0">
                                            {selectedProject ? (
                                                <span className="flex items-center gap-2 truncate">
                                                    <FolderKanban className="size-4 shrink-0" />
                                                        <span className="truncate">{selectedProject.display_name}</span>
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">Select a project</span>
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[400px]">
                                        {loadingProjects ? (
                                            <div className="p-2 text-sm text-muted-foreground">Loading projects...</div>
                                        ) : projects.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground">No projects available</div>
                                        ) : (
                                            projects.map((project) => (
                                                <DropdownMenuItem
                                                    key={project.id}
                                                    onClick={() => setSelectedProject(project)}
                                                    className="flex items-center gap-2"
                                                >
                                                    <FolderKanban className="size-4" />
                                                    <span>{project.display_name}</span>
                                                    <span className="ml-auto text-xs text-muted-foreground">
                                                        {project.meeting_count || 0} meetings
                                                    </span>
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="outline" size="icon" asChild>
                                    <Link href="/projects/new">
                                        <Plus className="size-4" />
                                    </Link>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Select an existing project or create a new one
                            </p>
                        </div>

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
                        <Link href="/meetings">Cancel</Link>
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!uploadedFile || !selectedProject || isProcessing}
                        className="gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="size-4" />
                                Upload Meeting
                            </>
                        )}
                    </Button>
                </div>

                {/* Discard Recording Confirmation Dialog */}
                <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cancel recording?</DialogTitle>
                            <DialogDescription>
                                Going to Upload File will stop and discard your current recording.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowDiscardDialog(false)}
                            >
                                Keep Recording
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    setShowDiscardDialog(false);
                                    setHasUnsavedRecording(false);
                                    setIsQuickRecordEntry(false);
                                    if (pendingMode) setInputMode(pendingMode);
                                }}
                            >
                                Cancel Recording
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}