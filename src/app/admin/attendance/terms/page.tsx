"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Pencil, X, Loader2, Filter, CheckCircle2, CalendarCheck, Building2, ChevronDown, DollarSign, Eye, Trash2 } from "lucide-react";
import { Term, Branch } from "@/lib/types";
import { termService } from "@/services/termService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { useAuth } from "@/lib/useAuth";

export default function TermsPage() {
    const { isSuperAdmin } = useAuth();
    const router = useRouter();
    const [terms, setTerms] = useState<Term[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTerm, setEditTerm] = useState<Term | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Filter state
    const [filterBranch, setFilterBranch] = useState("");
    const [filterTermName, setFilterTermName] = useState("all");

    // Form state
    const [formData, setFormData] = useState({
        term_name: "",
        start_date: "",
        end_date: "",
        branch_id: "",
        program_ids: [] as string[],
        status: "Upcoming" as "Active" | "Upcoming" | "Completed" | "Inactive",
        isRollover: true // Default checked
    });

    // Rollover Wizard State
    const [showRollover, setShowRollover] = useState(false);
    const [rolloverSource, setRolloverSource] = useState<Term | null>(null);
    const [rolloverStep, setRolloverStep] = useState(1);
    const [rolloverConfig, setRolloverConfig] = useState({
        targetName: "",
        startDate: "",
        endDate: "",
        includeActive: true,
        includeHold: false
    });

    // Real-time subscriptions
    useEffect(() => {
        const unsubTerms = termService.subscribe(async (data) => {
            // Auto-update expired terms to Inactive
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            for (const term of data) {
                const endDate = new Date(term.end_date);
                endDate.setHours(0, 0, 0, 0);
                
                // If term has expired and is still Active, update to Inactive
                if (endDate < today && term.status === 'Active') {
                    await termService.update(term.term_id, { status: 'Inactive' });
                }
            }
            
            setTerms(data);
            setLoading(false);
        });
        const unsubBranches = branchService.subscribe(setBranches);
        const unsubPrograms = programService.subscribe(setPrograms);

        return () => {
            unsubTerms();
            unsubBranches();
            unsubPrograms();
        };
    }, []);

    const openAdd = () => {
        setEditTerm(null);
        setFormData({
            term_name: "",
            start_date: "",
            end_date: "",
            branch_id: "",
            program_ids: [],
            status: "Upcoming",
            isRollover: true
        });
        setShowForm(true);
    };

    const openEdit = (term: Term) => {
        setEditTerm(term);
        setFormData({
            term_name: term.term_name,
            start_date: term.start_date,
            end_date: term.end_date,
            branch_id: term.branch_id,
            program_ids: term.program_ids || [],
            status: term.status,
            isRollover: false // No rollover on edit
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (editTerm) {
                // Remove isRollover from data sent to update
                const { isRollover, ...updateData } = formData;
                await termService.update(editTerm.term_id, updateData);
            } else {
                const { isRollover, ...termData } = formData;
                const newTermRef = await termService.add(termData as any);
                
                // Rollover Logic
                if (isRollover && formData.branch_id) {
                    const branchTerms = terms
                        .filter(t => t.branch_id === formData.branch_id)
                        .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
                    
                    // The new term is not in 'terms' state yet, or likely 'branchTerms' includes existing ones.
                    // We assume valid previous term has end_date before new term start_date
                    const previousTerm = branchTerms.find(t => new Date(t.end_date) <= new Date(formData.start_date));
                    
                    if (previousTerm) {
                       await termService.rolloverEnrollments(previousTerm.term_id, newTermRef.id);
                    }
                }
            }
            setShowForm(false);
        } catch (error) {
            console.error(error);
            alert("Failed to save term");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (termId: string) => {
        if (!confirm("Are you sure you want to delete this term?")) return;
        try {
            await termService.delete(termId);
        } catch (error) {
            console.error(error);
            alert("Failed to delete term");
        }
    };

    const openRolloverWizard = (term: Term) => {
        setRolloverSource(term);
        // Auto-calculate defaults for next term
        const startDate = new Date(term.end_date);
        startDate.setDate(startDate.getDate() + 1); // Start next day
        
        // 11 weeks duration (77 days)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (11 * 7)); 
        
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        
        let nextName = "New Term";
        try {
            const matches = term.term_name.match(/Term\s*(\d+)/i);
            const num = matches ? parseInt(matches[1]) : 0;
            const year = startDate.getFullYear();
            nextName = `Term${num + 1}-${year}`;
        } catch (e) {}

        setRolloverConfig({
            targetName: nextName,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            includeActive: true,
            includeHold: false
        });
        setRolloverStep(1);
        setShowRollover(true);
    };

    const handleRolloverSubmit = async () => {
        if (!rolloverSource) return;
        setSubmitting(true);
        try {
            // 1. Create New Term
            const newTermRef = await termService.add({
                term_name: rolloverConfig.targetName,
                start_date: rolloverConfig.startDate,
                end_date: rolloverConfig.endDate,
                branch_id: rolloverSource.branch_id,
                program_ids: rolloverSource.program_ids || [],
                status: 'Upcoming',
                created_at: new Date().toISOString()
            });

            // 2. Run Transfer
            await termService.rolloverEnrollments(
                rolloverSource.term_id, 
                newTermRef.id, 
                { 
                    includeActive: rolloverConfig.includeActive, 
                    includeHold: rolloverConfig.includeHold 
                }
            );

            alert("Term Transfer Complete!");
            setShowRollover(false);
        } catch (error) {
            console.error(error);
            alert("Transfer Failed. Check console.");
        } finally {
            setSubmitting(false);
        }
    };

    const getBranchName = (branchId: string) => {
        return branches.find(b => b.branch_id === branchId)?.branch_name || "Unknown";
    };

    const getProgramName = (programId: string) => {
        return programs.find(p => p.id === programId)?.name || "Unknown";
    };

    const getProgramNames = (programIds: string[]) => {
        if (!programIds || programIds.length === 0) return "None";
        return programIds.map(id => getProgramName(id)).join(", ");
    };

    const toggleProgram = (programId: string) => {
        setFormData(prev => ({
            ...prev,
            program_ids: prev.program_ids.includes(programId)
                ? prev.program_ids.filter(id => id !== programId)
                : [...prev.program_ids, programId]
        }));
    };

    // Helper to check if term is active
    const isTermActive = (term: Term) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(term.end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
    };

    const filteredTerms = terms.filter(term => {
        if (filterBranch && term.branch_id !== filterBranch) return false;
        if (filterTermName !== "all" && term.term_name !== filterTermName) return false;
        
        return true;
    });

    const uniqueTermNames = Array.from(new Set(terms.map(t => t.term_name))).sort();

    return (
        <div className="max-w-[1800px] mx-auto space-y-6 pb-20 px-4 md:px-0">
            {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
            <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 animate-in zoom-in-95 duration-500">
                    <Calendar size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Terms</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Term Management</span>
                        <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{terms.length} Total Terms</span>
                    </div>
                </div>
            </div>
            <button
                onClick={openAdd}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 transform hover:-translate-y-0.5"
            >
                <Plus size={18} />
                <span>New Term</span>
            </button>
        </div>

                {/* FILTERS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/40 backdrop-blur-xl p-2.5 rounded-[2.25rem] border border-white/60 shadow-xl shadow-slate-200/40">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {/* Branch Filter */}
                    <div className="relative group w-full sm:w-64">
                        <select
                            value={filterBranch}
                            onChange={(e) => setFilterBranch(e.target.value)}
                            className="w-full !pl-14 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:border-indigo-200 shadow-sm shadow-slate-100"
                        >
                            <option value="">All Branches</option>
                            {branches.map(b => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center pointer-events-none group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all duration-300 shadow-sm">
                             <Building2 size={14} />
                        </div>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-indigo-500 transition-colors" size={14} />
                    </div>

                    {/* Term Name Filter */}
                    <div className="relative group w-full sm:w-64">
                        <select
                            value={filterTermName}
                            onChange={(e) => setFilterTermName(e.target.value)}
                            className="w-full !pl-14 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:border-indigo-200 shadow-sm shadow-slate-100"
                        >
                            <option value="all">All Terms</option>
                            {uniqueTermNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center pointer-events-none group-focus-within:bg-amber-600 group-focus-within:text-white transition-all duration-300 shadow-sm">
                             <Filter size={14} />
                        </div>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-indigo-500 transition-colors" size={14} />
                    </div>
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-100 mx-2"></div>

                <div className="flex items-center gap-2 px-6 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100 w-full sm:w-auto justify-center sm:justify-start">
                     <CalendarCheck size={16} className="text-indigo-600" />
                     <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                         Filtering {filteredTerms.length} Results
                     </span>
                </div>
            </div>

            {/* FORM MODAL */}
            {showForm && (
                <div 
                    onClick={() => setShowForm(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]"
                    >
                        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 tracking-tight">
                                        {editTerm ? "Edit Term" : "Add Term"}
                                    </h2>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                                        {editTerm ? "Update details" : "Create new term"}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto">
                            <div className="space-y-6">
                                {/* Top Row: Name & Status */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide ml-1">Term Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.term_name}
                                            onChange={(e) => setFormData({ ...formData, term_name: e.target.value })}
                                            placeholder="e.g., 2026 Term 1"
                                            disabled={!!(editTerm && !isTermActive(editTerm))}
                                            className={`w-full px-5 py-3 rounded-2xl border ${editTerm && !isTermActive(editTerm) ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} font-bold outline-none transition-all`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide ml-1">Status</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                                disabled={!!(editTerm && !isTermActive(editTerm))}
                                                className={`w-full px-5 py-3 rounded-2xl border ${editTerm && !isTermActive(editTerm) ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} font-bold outline-none transition-all appearance-none`}
                                            >
                                                <option value="Upcoming">Upcoming</option>
                                                <option value="Active">Active</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <Filter size={14} />
                                        </div>
                                    </div>
                                     {!editTerm && (
                                        <div className="flex items-center gap-2 mt-8 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                            <input
                                                type="checkbox"
                                                id="rollover"
                                                checked={formData.isRollover}
                                                onChange={(e) => setFormData({ ...formData, isRollover: e.target.checked })}
                                                className="w-5 h-5 rounded-lg border-2 border-blue-200 text-blue-600 focus:ring-blue-500 rounded focus:ring-offset-0"
                                            />
                                            <label htmlFor="rollover" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                                                Bring students from the last term?
                                                <p className="text-[10px] text-slate-400 font-normal mt-0.5">Students will start as <span className="text-rose-500 font-black tracking-widest uppercase">"Unpaid"</span> for the new term.</p>
                                            </label>
                                        </div>
                                    )}
                                </div>
                                </div>

                                {/* Middle Row: Dates & Branch */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide ml-1">Start Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.start_date}
                                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                            disabled={!!(editTerm && !isTermActive(editTerm))}
                                            className={`w-full px-5 py-3 rounded-2xl border ${editTerm && !isTermActive(editTerm) ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} font-bold outline-none transition-all`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide ml-1">End Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.end_date}
                                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            disabled={!!(editTerm && !isTermActive(editTerm))}
                                            className={`w-full px-5 py-3 rounded-2xl border ${editTerm && !isTermActive(editTerm) ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} font-bold outline-none transition-all`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wide ml-1">Branch</label>
                                        <select
                                            required
                                            value={formData.branch_id}
                                            onChange={(e) => {
                                                setFormData({ ...formData, branch_id: e.target.value, program_ids: [] });
                                            }}
                                            disabled={!!(editTerm && !isTermActive(editTerm))}
                                            className={`w-full px-5 py-3 rounded-2xl border ${editTerm && !isTermActive(editTerm) ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'} font-bold outline-none transition-all appearance-none`}
                                        >
                                            <option value="">Select Branch</option>
                                            {branches.map(b => (
                                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Bottom Row: Programs */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 mb-3 uppercase tracking-wide ml-1">
                                        Programs <span className="text-slate-300 normal-case ml-1">(Select Multiple)</span>
                                    </label>
                                    <div className="border border-slate-200 rounded-[1.5rem] p-5 bg-slate-50/50 min-h-[100px] max-h-[180px] overflow-y-auto custom-scrollbar">
                                        <div className="flex flex-wrap gap-2">
                                            {!formData.branch_id ? (
                                                 <div className="w-full flex flex-col items-center justify-center py-4 text-slate-400 gap-2">
                                                    <Filter size={20} className="opacity-20" />
                                                    <p className="text-xs font-medium">Please select a branch first</p>
                                                 </div>
                                            ) : programs.filter(p => p.branchId === formData.branch_id).length === 0 ? (
                                                <div className="w-full flex flex-col items-center justify-center py-4 text-slate-400 gap-2">
                                                    <p className="text-xs font-medium">No programs found for this branch</p>
                                                </div>
                                            ) : (
                                                programs
                                                    .filter(p => !formData.branch_id || p.branchId === formData.branch_id)
                                                    .map(p => {
                                                    const isSelected = formData.program_ids.includes(p.id);
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => toggleProgram(p.id)}
                                                            disabled={!!(editTerm && !isTermActive(editTerm))}
                                                            className={`
                                                                group relative px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 transform hover:scale-105 active:scale-95
                                                                ${isSelected 
                                                                    ? (editTerm && !isTermActive(editTerm)) ? 'bg-indigo-300 text-white shadow-none cursor-not-allowed' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' 
                                                                    : (editTerm && !isTermActive(editTerm)) ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md'
                                                                }
                                                            `}
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                {isSelected && <CheckCircle2 size={14} className="animate-in zoom-in" />}
                                                                {p.name}
                                                            </span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-8 py-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || (editTerm !== null && editTerm.status === "Inactive")}
                                    className={`flex-1 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                        editTerm && editTerm.status === "Inactive"
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
                                    }`}
                                >
                                    {submitting ? <Loader2 className="animate-spin" /> : (
                                        <>
                                            <CheckCircle2 size={20} />
                                            <span>{editTerm ? (editTerm.status === "Inactive" ? "Cannot Edit Inactive Term" : "Update Term") : "Create Term"}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CARDS GRID */}
            <div>
                {loading ? (
                    <div className="p-32 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                    </div>
                ) : filteredTerms.length === 0 ? (
                    <div className="glass-panel p-16 text-center">
                        <Calendar className="mx-auto text-slate-300 mb-4" size={64} />
                        <p className="text-slate-400 text-sm">No terms found. Click "Add Term" to create one.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTerms.map(term => (
                            <div 
                                key={term.term_id} 
                                className="group relative bg-white border border-slate-200/60 rounded-[1.25rem] p-7 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] hover:scale-[1.02] hover:border-indigo-200 transition-all duration-500 overflow-hidden cursor-pointer active:scale-95"
                                onClick={() => router.push(`/admin/attendance/terms/${term.term_id}/classes`)}
                            >
                                {/* Premium Background Accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-bl-[4rem] group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-colors" />

                                {/* Header: Status & Actions */}
                                <div className="flex justify-between items-center mb-6 relative z-10">
                                    <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest ${
                                        isTermActive(term) 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-50' 
                                        : 'bg-slate-50 text-slate-400 border-slate-100'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isTermActive(term) ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                        {isTermActive(term) ? 'Active Term' : 'Inactive'}
                                    </div>

                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        {(() => {
                                            const branchTerms = terms.filter(t => t.branch_id === term.branch_id);
                                            const latestTerm = branchTerms.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
                                            if (latestTerm && latestTerm.term_id === term.term_id) {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openRolloverWizard(term);
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:text-white hover:bg-indigo-600 hover:shadow-md border border-transparent transition-all"
                                                        title="Move students to new term"
                                                    >
                                                        <CalendarCheck size={15} />
                                                    </button>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEdit(term);
                                            }}
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md border border-transparent hover:border-indigo-100 transition-all"
                                            title="Edit Term"
                                        >
                                            {isTermActive(term) ? <Pencil size={15} /> : <Eye size={15} />}
                                        </button>

                                        {isSuperAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(term.term_id);
                                                }}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-white hover:shadow-md border border-transparent hover:border-rose-100 transition-all"
                                                title="Delete Term"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="relative z-10 space-y-5">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors tracking-tight">{term.term_name}</h3>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl w-fit group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                                            <Calendar className="text-indigo-500" size={14} />
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                                {new Date(term.start_date).toLocaleDateString()} — {new Date(term.end_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 py-4 border-y border-slate-100/80">
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Branch</p>
                                            <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                                                    <Building2 size={16} />
                                                </div>
                                                {getBranchName(term.branch_id)}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 leading-none">Program</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {term.program_ids && term.program_ids.length > 0 ? (
                                                term.program_ids.slice(0, 3).map(pid => (
                                                    <span key={pid} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:border-indigo-100 group-hover:text-indigo-600 transition-all shadow-sm">
                                                        {getProgramName(pid)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-slate-300 text-[10px] font-bold italic uppercase tracking-widest leading-none">No programs linked</span>
                                            )}
                                            {term.program_ids && term.program_ids.length > 3 && (
                                                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    +{term.program_ids.length - 3} More
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ROLLOVER WIZARD MODAL */}
            {showRollover && rolloverSource && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800">Move Students to New Term</h2>
                            <button onClick={() => setShowRollover(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><X size={20} /></button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto">
                            {/* Step 1: Term Details */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Source Term</label>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-600 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                        {rolloverSource.term_name}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Target Term Name</label>
                                        <input
                                            value={rolloverConfig.targetName}
                                            onChange={e => setRolloverConfig({...rolloverConfig, targetName: e.target.value})}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-800 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Start Date</label>
                                        <input
                                            type="date"
                                            value={rolloverConfig.startDate}
                                            onChange={e => setRolloverConfig({...rolloverConfig, startDate: e.target.value})}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-800 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Transfer Rules */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h3 className="font-bold text-slate-800">Transfer Rules</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${rolloverConfig.includeActive ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <input type="checkbox" checked={rolloverConfig.includeActive} onChange={e => setRolloverConfig({...rolloverConfig, includeActive: e.target.checked})} className="mt-1 w-5 h-5 accent-indigo-600" />
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Active Students</p>
                                            <p className="text-[10px] text-slate-400 mt-1 italic font-bold">Transfer active students (<span className="text-rose-500 underline uppercase tracking-widest">Unpaid</span>)</p>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${rolloverConfig.includeHold ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <input type="checkbox" checked={rolloverConfig.includeHold} onChange={e => setRolloverConfig({...rolloverConfig, includeHold: e.target.checked})} className="mt-1 w-5 h-5 accent-indigo-600" />
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Hold Students</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Copy hold enrollments</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={handleRolloverSubmit}
                                disabled={submitting || (!rolloverConfig.includeActive && !rolloverConfig.includeHold)}
                                className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : <><CalendarCheck size={20} /> Transfer Now</>}
                            </button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
}
