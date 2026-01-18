"use client";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface DashboardLayoutProps {
    children: React.ReactNode;
    breadcrumbs?: Array<{ label: string; href?: string }>;
    title?: string;
}

export function DashboardLayout({ children, breadcrumbs = [], title }: DashboardLayoutProps) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
                            </BreadcrumbItem>
                            {breadcrumbs.map((crumb, index) => (
                                <span key={crumb.label} className="contents">
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        {index === breadcrumbs.length - 1 || !crumb.href ? (
                                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                </span>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    {title && (
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                        </div>
                    )}
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
