"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotesLanguageSwitcher } from "@/components/ui/notes-language-switcher";
import { 
    FileText, 
    Hash, 
    ListTodo, 
    Gavel, 
    Lightbulb, 
    HelpCircle,
    ChevronRight
} from "lucide-react";
import Link from "next/link";

interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
}

interface MeetingNotesDisplayProps {
    meetingId: string;
    initialNotes: MeetingNotes | null;
    initialLanguage?: string;
}

export function MeetingNotesDisplay({ 
    meetingId, 
    initialNotes,
    initialLanguage = 'en'
}: MeetingNotesDisplayProps) {
    const [notes, setNotes] = useState<MeetingNotes | null>(initialNotes);
    const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);

    const handleNotesChange = (newNotes: MeetingNotes, language: string) => {
        setNotes(newNotes);
        setCurrentLanguage(language);
    };

    return (
        <div className="space-y-6">
            {/* Language Switcher Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Notes Language
                </h3>
                <NotesLanguageSwitcher
                    meetingId={meetingId}
                    currentLanguage={currentLanguage}
                    onNotesChange={handleNotesChange}
                />
            </div>

            {notes ? (
                <>
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
                                <p className="whitespace-pre-wrap leading-relaxed">{notes.summary}</p>
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
                                {notes.keyTopics && notes.keyTopics.length > 0 ? (
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
                                {notes.actionItems && notes.actionItems.length > 0 ? (
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
                                {notes.decisions && notes.decisions.length > 0 ? (
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
                                {notes.assumptions && notes.assumptions.length > 0 ? (
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
                    {notes.qa && notes.qa.length > 0 && (
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
                </>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                            <FileText className="size-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">No Notes Generated Yet</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">
                                The notes for this meeting haven&apos;t been generated or are currently processing.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href={`/meetings/${meetingId}/extract`}>
                                Generate Notes
                                <ChevronRight className="size-4 ml-1" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
