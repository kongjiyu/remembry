import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, Upload, Search, MoreVertical, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const meetings = [
    {
        id: "1",
        title: "Weekly Team Standup",
        date: "Jan 18, 2026",
        time: "10:00 AM",
        duration: "45 min",
        status: "completed" as const,
        actionItems: 5,
        decisions: 2,
        speakers: 4,
    },
    {
        id: "2",
        title: "Product Review Q1",
        date: "Jan 17, 2026",
        time: "2:00 PM",
        duration: "1h 15min",
        status: "processing" as const,
        actionItems: 0,
        decisions: 0,
        speakers: 0,
    },
    {
        id: "3",
        title: "Client Kickoff - Project Alpha",
        date: "Jan 15, 2026",
        time: "9:00 AM",
        duration: "2h",
        status: "pending_review" as const,
        actionItems: 8,
        decisions: 4,
        speakers: 6,
    },
    {
        id: "4",
        title: "Design System Workshop",
        date: "Jan 14, 2026",
        time: "11:00 AM",
        duration: "1h 30min",
        status: "completed" as const,
        actionItems: 3,
        decisions: 5,
        speakers: 3,
    },
    {
        id: "5",
        title: "Sprint Planning",
        date: "Jan 12, 2026",
        time: "10:00 AM",
        duration: "1h",
        status: "completed" as const,
        actionItems: 12,
        decisions: 3,
        speakers: 5,
    },
];

function getStatusInfo(status: string) {
    switch (status) {
        case "completed":
            return {
                badge: <Badge className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="size-3" />Synced</Badge>,
                icon: CheckCircle2,
                color: "text-success",
            };
        case "processing":
            return {
                badge: <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><Loader2 className="size-3 animate-spin" />Processing</Badge>,
                icon: Loader2,
                color: "text-primary",
            };
        case "pending_review":
            return {
                badge: <Badge className="bg-warning/10 text-warning border-warning/20 gap-1"><AlertCircle className="size-3" />Review</Badge>,
                icon: AlertCircle,
                color: "text-warning",
            };
        default:
            return {
                badge: <Badge variant="secondary">Unknown</Badge>,
                icon: Clock,
                color: "text-muted-foreground",
            };
    }
}

export default function MeetingsPage() {
    return (
        <DashboardLayout breadcrumbs={[{ label: "Meetings" }]} title="Meetings">
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input placeholder="Search meetings..." className="pl-10" />
                    </div>
                    <Button asChild className="gap-2">
                        <Link href="/meetings/new">
                            <Upload className="size-4" />
                            Upload Recording
                        </Link>
                    </Button>
                </div>

                {/* Meetings Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {meetings.map((meeting) => {
                        const statusInfo = getStatusInfo(meeting.status);
                        return (
                            <Card key={meeting.id} className="group hover:shadow-lg transition-all hover:border-primary/50">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Mic className="size-5 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base line-clamp-1">{meeting.title}</CardTitle>
                                                <CardDescription>
                                                    {meeting.date} · {meeting.time}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/meetings/${meeting.id}`}>View Details</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/meetings/${meeting.id}/review`}>Review & Edit</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                                        <div className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {meeting.duration}
                                        </div>
                                        {meeting.speakers > 0 && (
                                            <span>{meeting.speakers} speakers</span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        {meeting.status === "completed" || meeting.status === "pending_review" ? (
                                            <div className="flex gap-4 text-sm">
                                                <span className="text-muted-foreground">
                                                    <span className="font-medium text-foreground">{meeting.actionItems}</span> tasks
                                                </span>
                                                <span className="text-muted-foreground">
                                                    <span className="font-medium text-foreground">{meeting.decisions}</span> decisions
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">Analyzing...</span>
                                        )}
                                        {statusInfo.badge}
                                    </div>
                                </CardContent>
                                <Link href={`/meetings/${meeting.id}`} className="absolute inset-0">
                                    <span className="sr-only">View meeting</span>
                                </Link>
                            </Card>
                        );
                    })}
                </div>

                {/* Empty State (hidden when there are meetings) */}
                {meetings.length === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
                                <Mic className="size-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">No meetings yet</h3>
                            <p className="text-muted-foreground text-center max-w-sm mb-4">
                                Upload your first meeting recording to get started with AI-powered transcription and note extraction.
                            </p>
                            <Button asChild>
                                <Link href="/meetings/new">
                                    <Upload className="size-4 mr-2" />
                                    Upload Recording
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
