"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole } from "@/lib/types";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
    requireActive?: boolean;
    fallbackPath?: string;
}

export function RoleGuard({ 
    children, 
    allowedRoles, 
    requireActive = true,
    fallbackPath = "/admin/dashboard" 
}: RoleGuardProps) {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.push("/login");
                return;
            }

            if (requireActive && !profile.active) {
                // If they are on the dashboard, we might show a message instead of redirecting
                // But for other pages, we can redirect or just let the dashboard handle it.
                // For now, if not active, they can only see a "Pending approval" state on dashboard.
                if (window.location.pathname !== "/admin/dashboard") {
                    router.push("/admin/dashboard");
                }
                return;
            }

            if (allowedRoles && !allowedRoles.includes(profile.role)) {
                router.push(fallbackPath);
            }
        }
    }, [profile, loading, router, allowedRoles, requireActive, fallbackPath]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (!profile) return null;

    if (requireActive && !profile.active && window.location.pathname !== "/admin/dashboard") {
        return null;
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
        return null;
    }

    return <>{children}</>;
}
