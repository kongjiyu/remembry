"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, ListTodo, Gavel, HelpCircle, FileText, ArrowLeft, Lightbulb, Hash } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
}

export function ExtractView({ 
    meetingId, 
    initialNotes 
}: { 
    meetingId: string; 
    initialNotes: MeetingNotes | null;
}) {
    const [notes, setNotes] = useState<MeetingNotes | null>(initialNotes);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleExtract = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/meetings/${meetingId}/extract`, {
                method: "POST",
            });
            
            if (!res.ok) {
                throw new Error("Failed to extract notes");
            }

            const data = await res.json();
            setNotes(data.notes);
            toast.success("Notes extracted successfully!");
            router.refresh();
        } catch (error) {
            toast.error("Failed to generate notes. Please try again.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!notes && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
                <div className="rounded-full bg-primary/10 p-6">
                    <FileText className="size-12 text-primary" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h2 className="text-2xl font-bold">Generate Meeting Notes</h2>
                    <p className="text-muted-foreground">
                        Use AI to analyze the transcription and extract a summary, key topics, action items, decisions, assumptions, and Q&A.
                    </p>
                </div>
                <Button size="lg" onClick={handleExtract}>
                    Start Extraction
                </Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
                <Loader2 className="size-12 animate-spin text-primary" />
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Analyzing Meeting...</h2>
                    <p className="text-muted-foreground">
                        This may take a few moments depending on the length of the meeting.
                    </p>
                </div>
            </div>
        );
    }

    // Display Notes
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExtract}>
                    Regenerate Notes
                </Button>
            </div>

            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="size-5 text-blue-500" />
                        Executive Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <p className="whitespace-pre-wrap leading-relaxed">{notes?.summary}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Key Topics */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Hash className="size-5 text-indigo-500" />
                            Key Topics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {notes?.keyTopics && notes.keyTopics.length > 0 ? (
                            <ul className="space-y-2">
                                {notes.keyTopics.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-sm">
                                        <div className="mt-1 size-1.5 rounded-full bg-indigo-500 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No key topics detected.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Action Items */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ListTodo className="size-5 text-green-500" />
                            Action Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {notes?.actionItems && notes.actionItems.length > 0 ? (
                            <ul className="space-y-2">
                                {notes.actionItems.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-sm">
                                        <div className="mt-1 size-1.5 rounded-full bg-green-500 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No action items detected.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Decisions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gavel className="size-5 text-orange-500" />
                            Key Decisions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {notes?.decisions && notes.decisions.length > 0 ? (
                            <ul className="space-y-2">
                                {notes.decisions.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-sm">
                                        <div className="mt-1 size-1.5 rounded-full bg-orange-500 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No decisions detected.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Assumptions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="size-5 text-yellow-500" />
                            Assumptions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {notes?.assumptions && notes.assumptions.length > 0 ? (
                            <ul className="space-y-2">
                                {notes.assumptions.map((item, i) => (
                                    <li key={i} className="flex gap-3 text-sm">
                                        <div className="mt-1 size-1.5 rounded-full bg-yellow-500 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No assumptions detected.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Q&A */}
            {notes?.qa && notes.qa.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="size-5 text-purple-500" />
                            Q&A
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {notes.qa.map((qa, i) => (
                                <div key={i} className="space-y-1">
                                    <p className="font-medium text-sm text-primary">Q: {qa.question}</p>
                                    <p className="text-sm text-muted-foreground">A: {qa.answer}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
