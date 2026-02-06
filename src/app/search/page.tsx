"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Sparkles, Loader2, Database, AlertCircle, FileText, X, MessageSquare, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

interface RAGStore {
    name: string;
    displayName: string;
    createTime?: string;
}

interface AggregatedChunk {
    storeName: string;
    storeDisplayName: string;
    text: string;
    documentName?: string;
    title?: string;
}

interface SearchResponse {
    answer: string;
    storeStats: Array<{
        storeName: string;
        storeDisplayName: string;
        success: boolean;
        chunkCount: number;
        error?: string;
    }>;
    aggregatedChunks: AggregatedChunk[];
    totalChunks: number;
}

// Markdown renderer - same as used in chatbox
function renderMarkdown(text: string) {
    if (!text) return { __html: '' };

    const lines = text.split('\n');
    let html = '';
    let listType: 'ul' | 'ol' | null = null;
    let paraBuffer = '';

    function flushPara() {
        if (paraBuffer) {
            html += `<p class="my-2">${paraBuffer}</p>`;
            paraBuffer = '';
        }
    }

    function flushList() {
        if (listType) {
            html += `</${listType}>`;
            listType = null;
        }
    }

    for (const rawLine of lines) {
        const line = rawLine
            .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
            .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>');

        const isOl = line.match(/^\s*\d+\.\s(.*)/);
        const isUl = line.match(/^\s*[\*\-]\s(.*)/);

        if (isOl) {
            flushPara();
            if (listType !== 'ol') {
                flushList();
                html += '<ol class="list-decimal list-inside my-2 pl-5 space-y-1">';
                listType = 'ol';
            }
            html += `<li>${isOl[1]}</li>`;
        } else if (isUl) {
            flushPara();
            if (listType !== 'ul') {
                flushList();
                html += '<ul class="list-disc list-inside my-2 pl-5 space-y-1">';
                listType = 'ul';
            }
            html += `<li>${isUl[1]}</li>`;
        } else {
            flushList();
            if (line.trim() === '') {
                flushPara();
            } else {
                paraBuffer += (paraBuffer ? '<br/>' : '') + line;
            }
        }
    }

    flushPara();
    flushList();

    return { __html: html };
}

// Simple markdown renderer with clickable citations
function MarkdownRenderer({ 
    content, 
    chunks, 
    onCitationClick 
}: { 
    content: string; 
    chunks: AggregatedChunk[];
    onCitationClick: (chunk: AggregatedChunk) => void;
}) {
    const lines = content.split('\n');
    const elements: React.ReactElement[] = [];
    let currentList: string[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(
                <ul key={`list-${elements.length}`} className="list-disc pl-6 my-2 space-y-1">
                    {currentList.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            );
            currentList = [];
        }
    };

    const flushCodeBlock = () => {
        if (codeLines.length > 0) {
            elements.push(
                <pre key={`code-${elements.length}`} className="bg-muted p-4 rounded-lg my-2 overflow-x-auto">
                    <code className="text-sm">{codeLines.join('\n')}</code>
                </pre>
            );
            codeLines = [];
        }
    };

    // Process citations in text
    const processInlineContent = (text: string, lineIdx: number) => {
        // Match [Document: filename] patterns
        const citationPattern = /\[Document:\s*([^\]]+)\]/g;
        const parts: (string | React.ReactElement)[] = [];
        let lastIndex = 0;
        let match;
        let citationIndex = 0;

        while ((match = citationPattern.exec(text)) !== null) {
            // Add text before citation
            if (match.index > lastIndex) {
                const beforeText = text.substring(lastIndex, match.index);
                parts.push(beforeText);
            }

            // Find matching chunk
            const docName = match[1].trim();
            const matchingChunk = chunks.find(c => 
                c.documentName === docName || c.title === docName
            );

            // Add clickable citation
            if (matchingChunk) {
                parts.push(
                    <button
                        key={`cite-${lineIdx}-${citationIndex++}`}
                        onClick={() => onCitationClick(matchingChunk)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded transition-colors"
                    >
                        <FileText className="size-3" />
                        {docName}
                    </button>
                );
            } else {
                parts.push(match[0]);
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : [text];
    };

    lines.forEach((line, idx) => {
        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                flushCodeBlock();
                inCodeBlock = false;
            } else {
                flushList();
                inCodeBlock = true;
            }
            return;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }

        // Headings
        if (line.startsWith('## ')) {
            flushList();
            elements.push(
                <h2 key={`h2-${idx}`} className="text-xl font-bold mt-6 mb-3">
                    {line.substring(3)}
                </h2>
            );
        } else if (line.startsWith('### ')) {
            flushList();
            elements.push(
                <h3 key={`h3-${idx}`} className="text-lg font-semibold mt-4 mb-2">
                    {line.substring(4)}
                </h3>
            );
        } else if (line.startsWith('#### ')) {
            flushList();
            elements.push(
                <h4 key={`h4-${idx}`} className="text-base font-medium mt-3 mb-2">
                    {line.substring(5)}
                </h4>
            );
        } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            currentList.push(line.trim().substring(2));
        } else if (line.trim() === '') {
            flushList();
            if (elements.length > 0 && elements[elements.length - 1].type !== 'div') {
                elements.push(<div key={`space-${idx}`} className="h-2" />);
            }
        } else {
            flushList();
            // Process inline formatting and citations
            const processed = processInlineContent(line, idx);
            
            elements.push(
                <p key={`p-${idx}`} className="my-2 leading-relaxed">
                    {processed.map((part, i) => {
                        if (typeof part === 'string') {
                            // Apply bold, italic, code formatting
                            const formatted = part
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
                            return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
                        }
                        return <span key={i}>{part}</span>;
                    })}
                </p>
            );
        }
    });

    flushList();
    flushCodeBlock();

    return <div className="space-y-1">{elements}</div>;
}

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Store selection
    const [availableStores, setAvailableStores] = useState<RAGStore[]>([]);
    const [selectedStores, setSelectedStores] = useState<string[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(true);

    // Citation dialog
    const [selectedChunk, setSelectedChunk] = useState<AggregatedChunk | null>(null);
    const [showCitationDialog, setShowCitationDialog] = useState(false);

    const handleCitationClick = (chunk: AggregatedChunk) => {
        setSelectedChunk(chunk);
        setShowCitationDialog(true);
    };

    // Fetch available stores on mount
    useEffect(() => {
        fetchAvailableStores();
    }, []);

    const fetchAvailableStores = async () => {
        try {
            setIsLoadingStores(true);
            const response = await fetch('/api/search/stores');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch stores');
            }
            
            setAvailableStores(data.stores || []);
            // Select all stores by default
            setSelectedStores(data.stores.map((s: RAGStore) => s.name) || []);
        } catch (err) {
            console.error('Error fetching stores:', err);
            setError(err instanceof Error ? err.message : 'Failed to load stores');
        } finally {
            setIsLoadingStores(false);
        }
    };

    const handleStoreToggle = (storeName: string) => {
        setSelectedStores(prev => 
            prev.includes(storeName)
                ? prev.filter(s => s !== storeName)
                : [...prev, storeName]
        );
    };

    const handleSelectAll = () => {
        if (selectedStores.length === availableStores.length) {
            setSelectedStores([]);
        } else {
            setSelectedStores(availableStores.map(s => s.name));
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || selectedStores.length === 0) {
            setError('Please enter a query and select at least one source');
            return;
        }

        setIsSearching(true);
        setError(null);
        setSearchResult(null);

        try {
            const response = await fetch('/api/search/multi-store', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query.trim(),
                    storeNames: selectedStores
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            setSearchResult(data);
        } catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred during search');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <DashboardLayout breadcrumbs={[{ label: "Search" }]} title="Multi-Store Search">
            <div className="max-w-4xl space-y-6">
                {/* Search Input */}
                <Card>
                    <CardContent className="p-4">
                        <form onSubmit={handleSearch} className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask anything across your knowledge sources..."
                                    className="pl-10 h-10"
                                    disabled={isSearching}
                                />
                            </div>
                            <Button 
                                type="submit" 
                                variant="outline"
                                size="sm"
                                disabled={isSearching || selectedStores.length === 0}
                            >
                                {isSearching ? (
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="size-4 mr-2" />
                                )}
                                Search
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Store Selection */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Select Knowledge Sources</CardTitle>
                                <CardDescription>
                                    Choose which sources to search ({selectedStores.length} of {availableStores.length} selected)
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                disabled={isLoadingStores}
                            >
                                {selectedStores.length === availableStores.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStores ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading sources...</span>
                            </div>
                        ) : availableStores.length === 0 ? (
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                                <AlertCircle className="size-5 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    No knowledge sources available. Create a project and add meetings to enable search.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {availableStores.map((store) => (
                                    <div
                                        key={store.name}
                                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => handleStoreToggle(store.name)}
                                    >
                                        <Checkbox
                                            checked={selectedStores.includes(store.name)}
                                            onCheckedChange={() => handleStoreToggle(store.name)}
                                        />
                                        <Database className="size-4 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium">{store.displayName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Example Questions - Only show when no search has been performed */}
                {!searchResult && !isSearching && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Try asking...</CardTitle>
                            <CardDescription>
                                Example questions to get you started
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {[
                                    "What were the key decisions from recent meetings?",
                                    "Summarize all action items across projects",
                                    "What technical challenges were discussed?",
                                    "Show me all pending tasks and their owners"
                                ].map((question, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setQuery(question)}
                                        className="flex items-center gap-3 p-3 rounded-lg text-left text-sm hover:bg-muted/50 transition-colors group border"
                                    >
                                        <MessageSquare className="size-4 text-muted-foreground shrink-0" />
                                        <span className="line-clamp-2 flex-1">{question}</span>
                                        <ArrowRight className="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error Display */}
                {error && (
                    <Card className="border-destructive">
                        <CardContent className="flex items-center gap-3 p-4">
                            <AlertCircle className="size-5 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Search Results */}
                {searchResult && (() => {
                    // Parse answer into sections
                    const answerText = searchResult.answer;
                    const overallSummaryMatch = answerText.match(/##\s*Overall Summary\s*\n([\s\S]*?)(?=##\s*Per-Source Details|###|\n##|$)/i);
                    const perSourceSectionMatch = answerText.match(/##\s*Per-Source Details\s*\n([\s\S]*$)/i);
                    
                    const overallSummary = overallSummaryMatch ? overallSummaryMatch[1].trim() : '';
                    const perSourceSection = perSourceSectionMatch ? perSourceSectionMatch[1].trim() : '';

                    // Extract individual source sections (### Source Name)
                    const sourceSections: Array<{ name: string; content: string }> = [];
                    if (perSourceSection) {
                        const sectionRegex = /###\s*([^\n]+)\n([\s\S]*?)(?=###|$)/g;
                        let match;
                        while ((match = sectionRegex.exec(perSourceSection)) !== null) {
                            sourceSections.push({
                                name: match[1].trim(),
                                content: match[2].trim()
                            });
                        }
                    }

                    return (
                        <>
                            {/* Overall Summary Card */}
                            {overallSummary && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Sparkles className="size-5 text-primary" />
                                            Overall Summary
                                        </CardTitle>
                                        <CardDescription>
                                            Synthesized insights from {searchResult.storeStats.filter(s => s.success).length} knowledge sources
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div 
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={renderMarkdown(overallSummary)}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Individual Source Cards */}
                            {sourceSections.length > 0 && sourceSections.map((section, idx) => (
                                <Card key={idx}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Database className="size-5 text-primary" />
                                            {section.name}
                                        </CardTitle>
                                        <CardDescription>
                                            Information from this specific source
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div 
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={renderMarkdown(section.content)}
                                        />
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Fallback if no structured sections */}
                            {!overallSummary && sourceSections.length === 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Search Results</CardTitle>
                                        <CardDescription>
                                            Retrieved {searchResult.totalChunks} chunks from {searchResult.storeStats.filter(s => s.success).length} sources
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div 
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={renderMarkdown(answerText)}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Source Statistics Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Source Statistics</CardTitle>
                                    <CardDescription>
                                        Retrieved information from {searchResult.totalChunks} document chunks
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {searchResult.storeStats.map((stat) => (
                                            <div
                                                key={stat.storeName}
                                                className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                                                    stat.success ? 'bg-muted/50 border' : 'bg-destructive/10 border border-destructive/20'
                                                }`}
                                            >
                                                <span className="font-medium">{stat.storeDisplayName}</span>
                                                {stat.success ? (
                                                    <span className="text-muted-foreground">{stat.chunkCount} chunks</span>
                                                ) : (
                                                    <span className="text-destructive text-xs">{stat.error || 'Failed'}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    );
                })()}

                {/* Citation Dialog */}
                <Dialog open={showCitationDialog} onOpenChange={setShowCitationDialog}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="size-5" />
                                Source Document
                            </DialogTitle>
                            <DialogDescription>
                                {selectedChunk?.storeDisplayName && (
                                    <span className="inline-flex items-center gap-1 text-xs">
                                        <Database className="size-3" />
                                        From: {selectedChunk.storeDisplayName}
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedChunk && (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Document Name</h4>
                                    <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                                        {selectedChunk.documentName || selectedChunk.title || 'Unnamed'}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Content</h4>
                                    <div className="text-sm bg-muted/50 px-4 py-3 rounded-lg border max-h-96 overflow-y-auto">
                                        <p className="whitespace-pre-wrap leading-relaxed">{selectedChunk.text}</p>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => setShowCitationDialog(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Info Card */}
                {!searchResult && !error && (
                    <Card className="border-dashed">
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                                <Sparkles className="size-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Powered by Gemini File Search</h3>
                                <p className="text-sm text-muted-foreground">
                                    Search across multiple knowledge sources simultaneously with AI-powered synthesis
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
