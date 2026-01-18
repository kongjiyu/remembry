"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, Database, FileText, ListTodo, RefreshCw } from "lucide-react";

export default function NotionSettingsPage() {
    const isConnected = false; // TODO: Replace with actual state

    return (
        <DashboardLayout
            breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Notion" }]}
            title="Notion Integration"
        >
            <div className="max-w-3xl space-y-6">
                {/* Connection Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="size-10 rounded bg-white flex items-center justify-center">
                                <svg viewBox="0 0 100 100" className="size-6">
                                    <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="#fff" />
                                    <path d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.917 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z" fill="#000" />
                                </svg>
                            </div>
                            Connect to Notion
                        </CardTitle>
                        <CardDescription>
                            Connect your Notion workspace to automatically sync meeting notes and tasks
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isConnected ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="size-5 text-success" />
                                        <div>
                                            <p className="font-medium">Connected to Workspace</p>
                                            <p className="text-sm text-muted-foreground">My Workspace</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        <RefreshCw className="size-4 mr-2" />
                                        Reconnect
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg border border-dashed text-center">
                                    <p className="text-muted-foreground mb-4">
                                        Click below to connect your Notion workspace via OAuth
                                    </p>
                                    <Button size="lg" className="gap-2">
                                        Connect Notion
                                        <ExternalLink className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Database Configuration */}
                <Card className={!isConnected ? "opacity-50" : ""}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="size-5" />
                            Database Configuration
                        </CardTitle>
                        <CardDescription>
                            Select which Notion databases to use for meeting notes and tasks
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <FileText className="size-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Meeting Notes Database</p>
                                    <p className="text-sm text-muted-foreground">
                                        {isConnected ? "Meeting Notes" : "Not configured"}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" disabled={!isConnected}>
                                Select
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <ListTodo className="size-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Tasks Database</p>
                                    <p className="text-sm text-muted-foreground">
                                        {isConnected ? "Action Items" : "Not configured"}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" disabled={!isConnected}>
                                Select
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Sync Settings */}
                <Card className={!isConnected ? "opacity-50" : ""}>
                    <CardHeader>
                        <CardTitle>Sync Settings</CardTitle>
                        <CardDescription>
                            Configure how meeting notes are synced to Notion
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Auto-sync on approval</p>
                                <p className="text-sm text-muted-foreground">
                                    Automatically sync to Notion when you approve meeting notes
                                </p>
                            </div>
                            <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Include transcript</p>
                                <p className="text-sm text-muted-foreground">
                                    Append full transcript to meeting notes page
                                </p>
                            </div>
                            <Badge variant="secondary">Disabled</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
