"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Sparkles, FileText, Loader2 } from "lucide-react";
import Link from "next/link";

interface GroundingChunk {
    retrievedContext?: {
        text?: string;
        uri?: string;
        title?: string;
    };
}

interface Message {
    role: "user" | "assistant";
    content: string;
    groundingChunks?: GroundingChunk[];
}

function AskQuestionContent() {
    const searchParams = useSearchParams();
    const [projectName, setProjectName] = useState<string | null>(null); // RAG store resource name
    const [displayName, setDisplayName] = useState<string | null>(null); // User-entered project name
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
    const [loadingExamples, setLoadingExamples] = useState(true);
    const [sourceModalOpen, setSourceModalOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState<string>("");

    useEffect(() => {
        const projectNameParam = searchParams?.get("projectName");
        const displayNameParam = searchParams?.get("displayName");
        
        setProjectName(projectNameParam);
        setDisplayName(displayNameParam);
    }, [searchParams]);

    // ... (rest of the component logic remains exactly the same until return)

    // Load example questions
    useEffect(() => {
        if (!projectName) return;

        const loadExamples = async () => {
            setLoadingExamples(true);
            try {
                const response = await fetch(`/api/ask/examples?projectName=${encodeURIComponent(projectName)}`);
                if (response.ok) {
                    const data = await response.json();
                    setExampleQuestions(data.questions || []);
                }
            } catch (error) {
                console.error("Failed to load example questions:", error);
            } finally {
                setLoadingExamples(false);
            }
        };

        loadExamples();
    }, [projectName]);

    const handleSendMessage = async (question?: string) => {
        const messageText = question || input.trim();
        if (!messageText || isLoading) return;

        const userMessage: Message = {
            role: "user",
            content: messageText
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/ask/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectName,  // RAG store resource name
                    question: messageText
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get answer (${response.status})`);
            }

            const data = await response.json();

            const assistantMessage: Message = {
                role: "assistant",
                content: data.answer || "No answer available",
                groundingChunks: data.groundingChunks || []
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Failed to send message:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            const assistantMessage: Message = {
                role: "assistant",
                content: `Sorry, I couldn't process your question. ${errorMessage}`
            };
            setMessages(prev => [...prev, assistantMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExampleClick = (question: string) => {
        handleSendMessage(question);
    };

    const handleSourceClick = (sourceText: string) => {
        setSelectedSource(sourceText);
        setSourceModalOpen(true);
    };

    const renderMarkdown = (text: string) => {
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
    };

    const getBackLink = () => {
        if (projectName) {
            return `/projects/${encodeURIComponent(projectName)}`;
        }
        return "/dashboard";
    };

    if (!projectName) {
        return (
            <DashboardLayout
                breadcrumbs={[{ label: "Ask Questions" }]}
                title="Ask Questions"
            >
                <Card className="p-6 max-w-md mx-auto mt-12">
                    <p className="text-muted-foreground mb-4">Invalid request. Please select a project to ask questions about.</p>
                    <Link href="/dashboard">
                        <Button className="w-full">Go to Dashboard</Button>
                    </Link>
                </Card>
            </DashboardLayout>
        );
    }

    const breadcrumbs = [
        { label: "Projects", href: "/projects" },
        ...(projectName ? [{ label: displayName || "Project", href: `/projects/${encodeURIComponent(projectName)}` }] : []),
        { label: "Ask Questions" }
    ];

    return (
        <DashboardLayout
            breadcrumbs={breadcrumbs}
            title={`Ask Questions: ${displayName || "Project"}`}
        >
            <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto space-y-4">
                    {/* Example Questions */}
                    {messages.length === 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Sparkles className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Example Questions</h2>
                            </div>
                            
                            {loadingExamples ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ) : exampleQuestions.length > 0 ? (
                                <div className="space-y-2">
                                    {exampleQuestions.map((question, index) => (
                                        <Button
                                            key={index}
                                            variant="outline"
                                            className="w-full justify-start text-left h-auto py-3 px-4"
                                            onClick={() => handleExampleClick(question)}
                                        >
                                            {question}
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No example questions available.</p>
                            )}
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                            <Card className={`max-w-[80%] p-4 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                {message.role === "user" ? (
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                ) : (
                                    <div 
                                        className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                                        dangerouslySetInnerHTML={renderMarkdown(message.content)}
                                    />
                                )}
                                
                                {/* Grounding Chunks / Sources */}
                                {message.role === "assistant" && message.groundingChunks && message.groundingChunks.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-border/50">
                                        <h4 className="text-xs font-semibold mb-2">Sources:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {message.groundingChunks.map((chunk, chunkIndex) => (
                                                chunk.retrievedContext?.text && (
                                                    <Button
                                                        key={chunkIndex}
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleSourceClick(chunk.retrievedContext!.text!)}
                                                        className="text-xs h-7"
                                                    >
                                                        <FileText className="size-3 mr-1" />
                                                        Source {chunkIndex + 1}
                                                    </Button>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                        <div className="flex justify-start">
                            <Card className="max-w-[80%] p-4 bg-muted">
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

                {/* Input Area */}
                <div className="border-t bg-background p-4 mt-4">
                    <div className="max-w-4xl mx-auto">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                            className="flex gap-2"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button type="submit" disabled={isLoading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Source Viewing Modal */}
            <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Source Document</DialogTitle>
                        <DialogDescription>
                            Content from the knowledge base used to answer your question
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                            {selectedSource}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}

export default function AskQuestionPage() {
    return (
        <Suspense fallback={
            <DashboardLayout breadcrumbs={[{ label: "Ask Questions" }]} title="Ask Questions">
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
            </DashboardLayout>
        }>
            <AskQuestionContent />
        </Suspense>
    );
}
