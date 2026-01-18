"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileAudio, X, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";

export default function NewMeetingPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith("audio/")) {
            setFile(droppedFile);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setIsUploading(true);
        // TODO: Implement actual upload logic
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsUploading(false);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <DashboardLayout
            breadcrumbs={[{ label: "Meetings", href: "/meetings" }, { label: "Upload" }]}
            title="Upload Recording"
        >
            <div className="max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* File Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Audio File</CardTitle>
                            <CardDescription>
                                Upload your meeting recording. Supported formats: MP3, WAV, M4A, WebM (max 100MB)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!file ? (
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-muted-foreground/25 hover:border-primary/50"
                                        }`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                                            <Upload className="size-7 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Drop your audio file here</p>
                                            <p className="text-sm text-muted-foreground">or click to browse</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                            <FileAudio className="size-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium truncate max-w-xs">{file.name}</p>
                                            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setFile(null)}
                                        disabled={isUploading}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Meeting Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Meeting Details</CardTitle>
                            <CardDescription>
                                Add optional information about this meeting
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
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="date" className="text-sm font-medium">
                                        Date
                                    </label>
                                    <Input
                                        id="date"
                                        type="date"
                                        defaultValue={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="time" className="text-sm font-medium">
                                        Time
                                    </label>
                                    <Input
                                        id="time"
                                        type="time"
                                        defaultValue="10:00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="participants" className="text-sm font-medium">
                                    Participants (optional)
                                </label>
                                <Textarea
                                    id="participants"
                                    placeholder="Enter participant names, one per line"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <Button type="submit" size="lg" disabled={!file || isUploading} className="gap-2">
                            {isUploading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="size-4" />
                                    Upload & Transcribe
                                </>
                            )}
                        </Button>
                        <Button type="button" variant="outline" size="lg" onClick={() => setFile(null)}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
