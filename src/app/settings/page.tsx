import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Palette } from "lucide-react";

export default function SettingsPage() {
    return (
        <DashboardLayout breadcrumbs={[{ label: "Settings" }]} title="Settings">
            <div className="max-w-3xl space-y-6">
                {/* Profile Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <User className="size-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Profile</CardTitle>
                                <CardDescription>Manage your account settings</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium">
                                    Display Name
                                </label>
                                <Input id="name" placeholder="Your name" defaultValue="Guest User" />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">
                                    Email
                                </label>
                                <Input id="email" type="email" placeholder="you@example.com" />
                            </div>
                        </div>
                        <Button>Save Changes</Button>
                    </CardContent>
                </Card>

                {/* Preferences */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Palette className="size-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Preferences</CardTitle>
                                <CardDescription>Customize your experience</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Theme</p>
                                <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                            </div>
                            <Badge variant="secondary">Dark Mode</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Default Language</p>
                                <p className="text-sm text-muted-foreground">Primary language for transcription</p>
                            </div>
                            <Badge variant="secondary">English</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Bell className="size-5 text-muted-foreground" />
                            <div>
                                <CardTitle>Notifications</CardTitle>
                                <CardDescription>Manage notification preferences</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Processing Complete</p>
                                    <p className="text-sm text-muted-foreground">Notify when transcription is ready</p>
                                </div>
                                <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
