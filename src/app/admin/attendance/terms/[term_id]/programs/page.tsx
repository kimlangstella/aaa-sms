"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { Term } from "@/lib/types";
import { termService } from "@/services/termService";
import { programService } from "@/services/programService";
import { useAuth } from "@/lib/useAuth";

export default function ProgramsPage() {
    const router = useRouter();
    const params = useParams();
    const termId = params.term_id as string;

    const { isSuperAdmin } = useAuth();
    const [term, setTerm] = useState<Term | null>(null);
    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleDeleteProgram = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
        try {
            await programService.delete(id);
        } catch (error) {
            console.error("Error deleting program:", error);
            alert("Failed to delete program. It may have associated classes or enrollments.");
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch term details
                const termData = await termService.getById(termId);
                setTerm(termData);

                // Fetch all programs
                const unsubPrograms = programService.subscribe(setPrograms);

                setLoading(false);

                return () => {
                    unsubPrograms();
                };
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, [termId]);

    // Filter programs by term's program_ids
    const filteredPrograms = programs.filter(program => {
        if (!term || !term.program_ids) return false;
        return term.program_ids.includes(program.id);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass p-3 px-5 rounded-3xl shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <BookOpen size={16} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Select Program</h1>
                        {term && (
                            <p className="text-xs text-slate-500">{term.term_name}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* PROGRAMS GRID */}
            <div>
                {filteredPrograms.length === 0 ? (
                    <div className="glass-panel p-16 text-center">
                        <BookOpen className="mx-auto text-slate-300 mb-4" size={64} />
                        <p className="text-slate-400 text-sm">No programs found for this term.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPrograms.map(program => (
                            <div
                                key={program.id}
                                onClick={() => router.push(`/admin/attendance/terms/${termId}/programs/${program.id}/classes`)}
                                className="glass-panel p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden"
                            >
                                {/* Program Icon */}
                                <div className="mb-4 flex items-center justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                        <BookOpen size={32} />
                                    </div>
                                </div>

                                {isSuperAdmin && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteProgram(program.id, program.name);
                                        }}
                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all absolute top-4 right-4 z-10"
                                        title="Delete Program"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}

                                {/* Program Name */}
                                <div className="text-center group-hover:translate-y-[-4px] transition-transform duration-300">
                                    <h3 className="text-lg font-black text-slate-900 mb-1">{program.name}</h3>
                                    {program.description && (
                                        <p className="text-xs text-slate-500 line-clamp-2">{program.description}</p>
                                    )}
                                </div>

                                {/* Click Indicator */}
                                <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold pt-3 border-t border-slate-100">
                                    <CheckCircle2 size={14} />
                                    <span>View Classes</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
