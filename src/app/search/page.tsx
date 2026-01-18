"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";

// Mock search results
const mockResults = [
    {
        id: "1",
        type: "decision" as const,
        content: "Decided to use Gemini 3 Flash for transcription instead of Google Speech-to-Text",
        meeting: "Technical Architecture Review",
        date: "Jan 15, 2026",
    },
    {
        id: "2",
        type: "action" as const,
        content: "Create project requirement document and define tech stack",
        owner: "Team Lead",
        dueDate: "Jan 20, 2026",
        meeting: "Project Kickoff",
    },
    {
        id: "3",
        type: "qa" as const,
        question: "What database should we use for the MVP?",
        answer: "Google Firestore for its serverless nature and real-time sync capabilities",
        meeting: "Technical Architecture Review",
        date: "Jan 15, 2026",
    },
];

const suggestedQueries = [
    "What were the key decisions from last week?",
    "Show me all overdue action items",
    "When did we discuss the database architecture?",
    "What did John say about the timeline?",
];

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setHasSearched(true);
        }
    };

    return (
        <DashboardLayout breadcrumbs={[{ label: "Search" }]} title="Search Meetings">
            <div className="max-w-3xl space-y-6">
                {/* Search Input */}
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <form onSubmit={handleSearch} className="flex">
                            <div className="relative flex-1">
                                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-primary" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask anything about your meetings..."
                                    className="border-0 h-14 pl-12 text-lg focus-visible:ring-0"
                                />
                            </div>
                            <Button type="submit" size="lg" className="h-14 rounded-none px-6">
                                <Search className="size-5 mr-2" />
                                Search
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Content */}
                {!hasSearched ? (
                    <>
                        {/* Suggested Queries */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Try asking...</CardTitle>
                                <CardDescription>
                                    AI-powered search across all your meeting transcripts and notes
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {suggestedQueries.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => {
                                                setQuery(suggestion);
                                                setHasSearched(true);
                                            }}
                                            className="flex items-center gap-3 p-3 rounded-lg text-left text-sm hover:bg-muted/50 transition-colors group"
                                        >
                                            <MessageSquare className="size-4 text-muted-foreground shrink-0" />
                                            <span className="line-clamp-1">{suggestion}</span>
                                            <ArrowRight className="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info Card */}
                        <Card className="border-dashed">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                                    <Sparkles className="size-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-medium">Powered by Gemini File Search</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Ask natural language questions across all your meeting decisions, action items, and discussions
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    /* Search Results */
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Found {mockResults.length} results for "{query}"
                        </p>

                        {mockResults.map((result) => (
                            <Card key={result.id} className="hover:border-primary/50 transition-colors cursor-pointer">
                                <CardContent className="p-4">
                                    {result.type === "decision" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium uppercase text-primary">Decision</span>
                                                <span>·</span>
                                                <span>{result.meeting}</span>
                                                <span>·</span>
                                                <span>{result.date}</span>
                                            </div>
                                            <p className="font-medium">{result.content}</p>
                                        </div>
                                    )}

                                    {result.type === "action" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium uppercase text-accent">Action Item</span>
                                                <span>·</span>
                                                <span>{result.meeting}</span>
                                            </div>
                                            <p className="font-medium">{result.content}</p>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span>Owner: {result.owner}</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-3" />
                                                    Due: {result.dueDate}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {result.type === "qa" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium uppercase text-warning">Q&A</span>
                                                <span>·</span>
                                                <span>{result.meeting}</span>
                                                <span>·</span>
                                                <span>{result.date}</span>
                                            </div>
                                            <p className="font-medium">Q: {result.question}</p>
                                            <p className="text-muted-foreground">A: {result.answer}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
