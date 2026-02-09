"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <DashboardLayout breadcrumbs={[{ label: "Settings" }]} title="Settings">
                <div className="max-w-3xl animate-pulse">
                    <div className="h-48 bg-muted rounded-xl"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout breadcrumbs={[{ label: "Settings" }]} title="Settings">
            <div className="max-w-3xl space-y-6">
                {/* Appearance / Preferences */}
                <Card className="border-none shadow-sm bg-card/50 backdrop-blur-xl">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Palette className="size-5" />
                            </div>
                            <div>
                                <CardTitle>Appearance</CardTitle>
                                <CardDescription>Customize how Remembry looks on your device</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Theme Mode</p>
                            <div className="grid grid-cols-3 gap-4">
                                <Button
                                    variant={theme === "light" ? "default" : "outline"}
                                    className="flex flex-col items-center gap-2 h-24 rounded-xl transition-all"
                                    onClick={() => setTheme("light")}
                                >
                                    <Sun className="size-5" />
                                    <span>Light</span>
                                </Button>
                                <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    className="flex flex-col items-center gap-2 h-24 rounded-xl transition-all"
                                    onClick={() => setTheme("dark")}
                                >
                                    <Moon className="size-5" />
                                    <span>Dark</span>
                                </Button>
                                <Button
                                    variant={theme === "system" ? "default" : "outline"}
                                    className="flex flex-col items-center gap-2 h-24 rounded-xl transition-all"
                                    onClick={() => setTheme("system")}
                                >
                                    <Monitor className="size-5" />
                                    <span>System</span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}