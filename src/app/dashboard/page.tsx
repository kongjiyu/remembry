import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, FileText, Clock, CheckCircle2, AlertCircle, Upload, TrendingUp } from "lucide-react";
import Link from "next/link";

// Mock data for demonstration
const recentMeetings = [
    {
        id: "1",
        title: "Weekly Team Standup",
        date: "Jan 18, 2026",
        duration: "45 min",
        status: "completed" as const,
        actionItems: 5,
        decisions: 2,
    },
    {
        id: "2",
        title: "Product Review Q1",
        date: "Jan 17, 2026",
        duration: "1h 15min",
        status: "processing" as const,
        actionItems: 0,
        decisions: 0,
    },
    {
        id: "3",
        title: "Client Kickoff - Project Alpha",
        date: "Jan 15, 2026",
        duration: "2h",
        status: "pending_review" as const,
        actionItems: 8,
        decisions: 4,
    },
];

const stats = [
    { label: "Total Meetings", value: "24", icon: Mic, change: "+3 this week" },
    { label: "Action Items", value: "47", icon: CheckCircle2, change: "12 completed" },
    { label: "Decisions Logged", value: "31", icon: FileText, change: "+5 this week" },
    { label: "Hours Saved", value: "18h", icon: Clock, change: "This month" },
];

function getStatusBadge(status: string) {
    switch (status) {
        case "completed":
            return <Badge className="bg-success/10 text-success border-success/20">Synced</Badge>;
        case "processing":
            return <Badge className="bg-primary/10 text-primary border-primary/20">Processing</Badge>;
        case "pending_review":
            return <Badge className="bg-warning/10 text-warning border-warning/20">Pending Review</Badge>;
        default:
            return <Badge variant="secondary">Unknown</Badge>;
    }
}

export default function DashboardPage() {
    return (
        <DashboardLayout breadcrumbs={[{ label: "Dashboard" }]} title="Dashboard">
            <div className="space-y-6">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-4">
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/meetings/new">
                            <Upload className="size-5" />
                            Upload Recording
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="gap-2">
                        <Link href="/meetings">
                            <FileText className="size-5" />
                            View All Meetings
                        </Link>
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat) => (
                        <Card key={stat.label} className="relative overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {stat.label}
                                </CardTitle>
                                <stat.icon className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <TrendingUp className="size-3" />
                                    {stat.change}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Recent Meetings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Recent Meetings</CardTitle>
                                <CardDescription>Your latest recorded meetings and their status</CardDescription>
                            </div>
                            <Button variant="ghost" asChild>
                                <Link href="/meetings">View all</Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentMeetings.map((meeting) => (
                                <Link
                                    key={meeting.id}
                                    href={`/meetings/${meeting.id}`}
                                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                                            <Mic className="size-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium">{meeting.title}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {meeting.date} · {meeting.duration}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {meeting.status === "completed" && (
                                            <div className="text-right text-sm">
                                                <p className="font-medium">{meeting.actionItems} action items</p>
                                                <p className="text-muted-foreground">{meeting.decisions} decisions</p>
                                            </div>
                                        )}
                                        {getStatusBadge(meeting.status)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Notion Connection Status */}
                <Card className="border-dashed">
                    <CardContent className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                                <AlertCircle className="size-6 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-medium">Connect Notion</h3>
                                <p className="text-sm text-muted-foreground">
                                    Link your Notion workspace to sync meeting notes automatically
                                </p>
                            </div>
                        </div>
                        <Button asChild>
                            <Link href="/settings/notion">Connect</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
