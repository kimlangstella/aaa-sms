"use client";

import { useEffect, useState } from "react";
import { X, UserPlus, FileSpreadsheet, ChevronRight, Users, Download } from "lucide-react";

interface StudentActionSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (action: 'single' | 'import') => void;
}

export default function StudentActionSelectionModal({ isOpen, onClose, onSelect }: StudentActionSelectionModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to allow render before animating in
            const timer = setTimeout(() => setIsVisible(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!shouldRender) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
                isVisible ? 'bg-slate-900/60 backdrop-blur-md' : 'bg-transparent pointer-events-none'
            }`}
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-[550px] bg-white rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform ring-1 ring-white/20 ${
                    isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'
                }`}
            >
                {/* Header */}
                <div className="relative p-6 pb-2 flex justify-between items-start z-10">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add Students</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Select an import method.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Decorative Background Blob */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-0 pointer-events-none" />

                {/* Options Grid */}
                <div className="p-6 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                    {/* Option 1: Single Student */}
                    <div
                        onClick={() => onSelect('single')}
                        className="group relative flex flex-col items-start p-1 rounded-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1 h-full"
                    >
                        {/* Gradient Border Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl group-hover:from-indigo-500 group-hover:to-purple-500 transition-all duration-300 opacity-100" />
                        
                        {/* Inner Content */}
                        <div className="relative w-full h-full bg-white rounded-[0.9rem] p-5 flex flex-col transition-all duration-300 group-hover:bg-white/95">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center mb-4 transition-all duration-300 shadow-sm group-hover:shadow-indigo-200 group-hover:scale-110">
                                <UserPlus size={22} />
                            </div>
                            
                            <h3 className="text-lg font-black text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">Add Student</h3>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed mb-4 group-hover:text-slate-600">
                                Manual entry for single profile.
                            </p>
                            
                            <div className="mt-auto flex items-center text-xs font-bold text-slate-300 group-hover:text-indigo-600 transition-colors">
                                <span>Continue</span>
                                <ChevronRight size={14} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {/* Option 2: Bulk Import */}
                    <div
                        onClick={() => onSelect('import')}
                        className="group relative flex flex-col items-start p-1 rounded-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1 h-full"
                    >
                        {/* Gradient Border Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl group-hover:from-emerald-400 group-hover:to-teal-500 transition-all duration-300 opacity-100" />
                        
                        {/* Inner Content */}
                        <div className="relative w-full h-full bg-white rounded-[0.9rem] p-5 flex flex-col transition-all duration-300 group-hover:bg-white/95">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center mb-4 transition-all duration-300 shadow-sm group-hover:shadow-emerald-200 group-hover:scale-110">
                                <FileSpreadsheet size={22} />
                            </div>
                            
                            <h3 className="text-lg font-black text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors">Import Students</h3>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed mb-4 group-hover:text-slate-600">
                                Upload Excel/CSV for bulk add.
                            </p>
                            
                            <div className="mt-auto flex items-center text-xs font-bold text-slate-300 group-hover:text-emerald-600 transition-colors">
                                <span>Continue</span>
                                <ChevronRight size={14} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
