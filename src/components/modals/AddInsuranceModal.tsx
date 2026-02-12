import { useState, useEffect } from "react";
import { X, Save, Shield, Search, CheckCircle2, Plus } from "lucide-react";
import { updateStudent, subscribeToStudents } from "@/lib/services/schoolService";
import { Student } from "@/lib/types";

interface AddInsuranceModalProps {
  studentId?: string; // Optional now
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
      policyNumber?: string;
      startDate?: string;
      endDate?: string;
      coverageAmount?: number;
      studentName?: string;
  };
}

export function AddInsuranceModal({ studentId: propStudentId, isOpen, onClose, onSuccess, initialData }: AddInsuranceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  
  // Insurance Form State
  const [formDataState, setFormDataState] = useState({
      policyNumber: initialData?.policyNumber || "",
      startDate: initialData?.startDate || "",
      endDate: initialData?.endDate || "",
      coverageAmount: String(initialData?.coverageAmount || "0")
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
        setSelectedStudent(null);
        setSearchQuery("");
        setSearchResults([]);
        setFormDataState({
            policyNumber: initialData?.policyNumber || "",
            startDate: initialData?.startDate || "",
            endDate: initialData?.endDate || "",
            coverageAmount: String(initialData?.coverageAmount || "0")
        });
    }
}, [isOpen, initialData]);

  // Subscribe to all students on open
  useEffect(() => {
    if (!isOpen) return;

    if (!propStudentId) {
        const unsubscribe = subscribeToStudents((data) => {
            setAllStudents(data);
        });
        return () => unsubscribe();
    } else {
        // Fetch specific student for pre-filling
        const { getStudentById } = require("@/lib/services/schoolService");
        getStudentById(propStudentId).then((student: Student | null) => {
            if (student) {
                setSelectedStudent(student);
                if (student.insurance_info) {
                    setFormDataState({
                        policyNumber: student.insurance_info.policy_number || "",
                        startDate: student.insurance_info.start_date || "",
                        endDate: student.insurance_info.end_date || "",
                        coverageAmount: String(student.insurance_info.coverage_amount || "0")
                    });
                }
            }
        });
    }
  }, [isOpen, propStudentId]);

  // Filter students locally
  useEffect(() => {
    if (!isOpen) return;
    
    // If no query, don't show any results
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

  // Update form state when a student is selected from search
  useEffect(() => {
      if (selectedStudent?.insurance_info && !propStudentId) {
          setFormDataState({
              policyNumber: selectedStudent.insurance_info.policy_number || "",
              startDate: selectedStudent.insurance_info.start_date || "",
              endDate: selectedStudent.insurance_info.end_date || "",
              coverageAmount: String(selectedStudent.insurance_info.coverage_amount || "0")
          });
      }
  }, [selectedStudent, propStudentId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      
      const finalStudentId = propStudentId || selectedStudent?.student_id;

      if (!finalStudentId) {
          alert("Please select a student first.");
          return;
      }

      setSubmitting(true);
      
      const insuranceInfo = {
          provider: "School Standard",
          policy_number: formDataState.policyNumber,
          type: "General",
          coverage_amount: Number(formDataState.coverageAmount) || 0,
          start_date: formDataState.startDate,
          end_date: formDataState.endDate,
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
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl animate-in zoom-in-95 relative overflow-hidden"> 
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Shield size={18} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800">
                            {propStudentId ? "Renew Insurance" : "Add Insurance"}
                        </h3>
                        {(selectedStudent || initialData?.studentName) && (
                            <p className="text-xs text-slate-500 font-medium">
                                For: <span className="text-indigo-600 font-bold">{selectedStudent?.student_name || initialData?.studentName}</span>
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
            
            <form id="insurance-form" onSubmit={handleSubmit} className="p-5 space-y-3.5">
                {/* Student Selection (Integrated into flow) */}
                {!propStudentId && !selectedStudent && (
                    <div className="space-y-3 mb-3">
                        <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Student First</h4>
                            <div className="relative group mb-3">
                                <input 
                                    type="text"
                                    placeholder="Search student name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-5 pr-12 py-2.5 bg-white border border-slate-200 rounded-[1.25rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                                    autoFocus
                                />
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <Search className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                                </div>
                            </div>

                            {/* Dropdown (Only show if searching) */}
                            {searchQuery.trim() && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                    {searchResults.length > 0 ? searchResults.map(s => (
                                        <button 
                                            key={s.student_id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudent(s);
                                                setSearchQuery(""); // Clear search after selection
                                            }}
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
                    <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl mb-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3">
                             <div className="w-9 h-9 rounded-xl bg-indigo-200 text-indigo-700 flex items-center justify-center font-black text-xs">
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
                            value={formDataState.policyNumber}
                            onChange={(e) => setFormDataState(prev => ({ ...prev, policyNumber: e.target.value }))}
                            placeholder="e.g. INS-2024-001" 
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" 
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coverage Amount ($)</label>
                        <input 
                            name="ins_coverage_amount" 
                            type="number"
                            value={formDataState.coverageAmount}
                            onChange={(e) => setFormDataState(prev => ({ ...prev, coverageAmount: e.target.value }))}
                            placeholder="0.00" 
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                    </div>

                    <div className={`grid grid-cols-2 gap-3 ${(!propStudentId && !selectedStudent) ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                            <input 
                                name="ins_start_date" 
                                type="date" 
                                required 
                                value={formDataState.startDate}
                                onChange={(e) => setFormDataState(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expired Date</label>
                            <input 
                                name="ins_end_date" 
                                type="date" 
                                required 
                                value={formDataState.endDate}
                                onChange={(e) => setFormDataState(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 border border-slate-200 transition-all" 
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                    <button 
                        type="submit" 
                        disabled={submitting || (!propStudentId && !selectedStudent)}
                        className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
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
