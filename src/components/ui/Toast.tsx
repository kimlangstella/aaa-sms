"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export type ToastProps = {
    message: string;
    type?: "success" | "error" | "loading";
    isVisible: boolean;
    onClose: () => void;
};

export function Toast({ message, type = "success", isVisible, onClose }: ToastProps) {
    useEffect(() => {
        if (isVisible && type !== "loading") {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, type, onClose]);

    if (!isVisible) return null;

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border ${
                type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-200/50' :
                type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-200/50' :
                'bg-blue-50 text-blue-800 border-blue-200 shadow-blue-200/50'
            }`}>
                {type === 'success' && <CheckCircle size={24} className="text-emerald-500" />}
                {type === 'error' && <XCircle size={24} className="text-rose-500" />}
                {type === 'loading' && <Loader2 size={24} className="text-blue-500 animate-spin" />}
                <p className="font-bold text-sm tracking-wide">{message}</p>
            </div>
        </div>
    );
}
