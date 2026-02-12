import { useState, useEffect } from "react";
import { X, Save, Shield, Search, CheckCircle2, Plus } from "lucide-react";
import { updateStudent, subscribeToStudents } from "@/lib/services/schoolService";
import { Student } from "@/lib/types";

interface AddInsuranceModalProps {
  studentId?: string; // Optional now
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddInsuranceModal({ studentId: propStudentId, isOpen, onClose, onSuccess }: AddInsuranceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setSelectedStudent(null);
        setSearchQuery("");
        setSearchResults([]);
    }
  }, [isOpen]);

  // Subscribe to all students on open
  useEffect(() => {
    if (!isOpen || propStudentId) return;

    const unsubscribe = subscribeToStudents((data) => {
        setAllStudents(data);
    });

    return () => unsubscribe();
  }, [isOpen, propStudentId]);

  // Filter students locally
  useEffect(() => {
    if (!isOpen) return;
    
    // If no query, don't show any results (User request: "search name not show all")
    if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = allStudents.filter(s => {
        const name = (s.student_name || "").toLowerCase();
        const first = (s.first_name || "").toLowerCase();
        const last = (s.last_name || "").toLowerCase();
        const code = (s.student_code || "").toLowerCase();
        
        return name.includes(query) || 
               first.includes(query) || 
               last.includes(query) || 
               code.includes(query);
    });
    setSearchResults(filtered.slice(0, 5));
  }, [searchQuery, allStudents, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      
      const finalStudentId = propStudentId || selectedStudent?.student_id;

      if (!finalStudentId) {
          alert("Please select a student first.");
          return;
      }

      setSubmitting(true);
      
      const formData = new FormData(e.currentTarget);
      const insuranceInfo = {
          provider: "School Standard",
          policy_number: formData.get("ins_policy_number") as string,
          type: "General",
          coverage_amount: 0,
          start_date: formData.get("ins_start_date") as string,
          end_date: formData.get("ins_end_date") as string,
      };

      try {
          await updateStudent(finalStudentId, { insurance_info: insuranceInfo });
          onSuccess();
          onClose();
      } catch (error) {
          console.error("Error adding insurance:", error);
          alert("Failed to add insurance.");
      } finally {
          setSubmitting(false);
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl animate-in zoom-in-95 relative overflow-hidden"> 
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Add Insurance</h3>
                        {selectedStudent && <p className="text-xs text-slate-500 font-medium">For: <span className="text-indigo-600 font-bold">{selectedStudent.student_name}</span></p>}
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
            
            <form id="insurance-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Student Selection (Integrated into flow) */}
                {!propStudentId && !selectedStudent && (
                    <div className="space-y-4 mb-4">
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Select Student First</h4>
                             <div className="relative group mb-4">
                                <input 
                                    type="text"
                                    placeholder="Search student name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-5 pr-12 py-3 bg-white border border-slate-200 rounded-[1.25rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                                    autoFocus
                                />
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <Search className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                </div>
                             </div>

                             {/* Embedded Results (Only show if searching) */}
                             {searchQuery.trim() && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                    {searchResults.length > 0 ? searchResults.map(s => (
                                        <button 
                                            key={s.student_id}
                                            type="button"
                                            onClick={() => setSelectedStudent(s)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors"
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{s.student_name}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{s.student_code}</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-all">
                                                <Plus size={16} />
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="px-4 py-6 text-sm text-slate-400 italic text-center">
                                            No students found for &quot;{searchQuery}&quot;
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>
                    </div>
                )}
                
                {/* Selected Student Display */}
                {!propStudentId && selectedStudent && (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-700 flex items-center justify-center font-black text-sm">
                                 {selectedStudent.student_name.charAt(0)}
                             </div>
                             <div>
                                 <p className="text-sm font-black text-indigo-900">{selectedStudent.student_name}</p>
                                 <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{selectedStudent.student_code}</p>
                             </div>
                        </div>
                        <button type="button" onClick={() => setSelectedStudent(null)} className="px-3 py-1.5 bg-white border border-indigo-200 text-[10px] font-black uppercase tracking-widest text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">Change</button>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Insurance Number</label>
                        <input 
                            name="ins_policy_number" 
                            required 
                            placeholder="e.g. INS-2024-001" 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" 
                        />
                    </div>

                    <div className={`grid grid-cols-2 gap-4 ${(!propStudentId && !selectedStudent) ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                            <input name="ins_start_date" type="date" required className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expired Date</label>
                            <input name="ins_end_date" type="date" required className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" />
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                    <button 
                        type="submit" 
                        disabled={submitting || (!propStudentId && !selectedStudent)}
                        className="px-8 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                    >
                        <CheckCircle2 size={16} />
                        Save Insurance
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
}
