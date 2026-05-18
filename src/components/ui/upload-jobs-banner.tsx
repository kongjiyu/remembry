"use client";

import { useEffect, useRef } from "react";
import { useUploadJobs } from "@/hooks/useUploadJobs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface UploadJobsBannerProps {
    onJobCompleted?: (jobId: string) => void;
}

export function UploadJobsBanner({ onJobCompleted }: UploadJobsBannerProps) {
    const { activeJobs, failedJobs, completedJobs } = useUploadJobs();
    const seenRef = useRef<Set<string>>(new Set());

    // Fire callback once per newly completed job
    useEffect(() => {
        if (!onJobCompleted) return;
        for (const job of completedJobs) {
            if (!seenRef.current.has(job.job_id)) {
                seenRef.current.add(job.job_id);
                onJobCompleted(job.job_id);
            }
        }
    }, [completedJobs, onJobCompleted]);

    if (activeJobs.length === 0 && failedJobs.length === 0) {
        return null;
    }

    return (
        <>
            {/* ACTIVE UPLOADS STRIP */}
            {activeJobs.length > 0 && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Loader2 className="size-4 animate-spin text-blue-500" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Active uploads</span>
                        </div>
                        <div className="space-y-2">
                            {activeJobs.map((job) => (
                                <div key={job.job_id} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{job.title}</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">{job.message}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="w-24 h-2 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-blue-600 dark:text-blue-400 w-8">{job.progress}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* FAILED / CANCELLED JOBS */}
            {failedJobs.length > 0 && (
                <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="size-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">Failed uploads</span>
                        </div>
                        {failedJobs.map((job) => (
                            <div key={job.job_id} className="flex items-center gap-3 py-1">
                                <span className="text-sm truncate flex-1">{job.title}</span>
                                <span className="text-xs text-red-500 shrink-0">{job.error || job.status}</span>
                                {job.meeting_id && (
                                    <Link
                                        href={`/meetings/detail?id=${encodeURIComponent(job.meeting_id)}`}
                                        className="text-xs text-primary hover:underline shrink-0"
                                    >
                                        View
                                    </Link>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </>
    );
}