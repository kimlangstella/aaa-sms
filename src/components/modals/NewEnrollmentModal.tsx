"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  BookOpen, 
  CreditCard, 
  Loader2, 
  Check, 
  Calendar,
  PlusCircle
} from "lucide-react";
import { 
    branchService 
} from "@/services/branchService";
import { 
    programService 
} from "@/services/programService";
import { 
    termService 
} from "@/services/termService";
import { 
    getClasses, 
    addEnrollment 
} from "@/lib/services/schoolService";
import { Branch, Class, Term, Student } from "@/lib/types";

interface NewEnrollmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
    onSuccess: () => void;
}

export function NewEnrollmentModal({ isOpen, onClose, student, onSuccess }: NewEnrollmentModalProps) {
    const [submitting, setSubmitting] = useState(false);
    
    // Add-ons State
    const [addons, setAddons] = useState({
        uniform: false,
        uniformFee: "0.00",
        book: false,
        bookFee: "0.00"
    });

    // Data
    const [branches, setBranches] = useState<Branch[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [activeTerm, setActiveTerm] = useState<Term | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        branch_id: student.branch_id || "", // Default to student's branch
        program_id: "",
        class_id: "",
        start_session: "",
        term_id: "",
        
        // Payment
        total_amount: "0",
        discount: "0",
        paid_amount: "0",
        payment_type: "Cash",
        payment_due_date: "",
        payment_status: "Unpaid" as "Paid" | "Unpaid"
    });

    const [selectedProgram, setSelectedProgram] = useState<any>(null);

    // Load Initial Data
    useEffect(() => {
        if (isOpen) {
            const unsubBranches = branchService.subscribe(setBranches);
            const unsubTerms = termService.subscribe((data) => {
                setTerms(data);
                const active = data.find(t => t.status === 'Active');
                setActiveTerm(active || null);
                if (active) {
                    setFormData(prev => ({ 
                        ...prev, 
                        term_id: active.term_id,
                        payment_due_date: active.end_date 
                    }));
                }
            });

            return () => {
                unsubBranches();
                unsubTerms();
            }
        }
    }, [isOpen]);

    // Fetch Programs/Classes when Branch changes
    useEffect(() => {
        if (formData.branch_id) {
            programService.getAll([formData.branch_id]).then(setPrograms).catch(console.error);
            getClasses(formData.branch_id).then(setClasses).catch(console.error);
        } else {
            setPrograms([]);
            setClasses([]);
        }
    }, [formData.branch_id]);

    // Update Price when Program Changes
    useEffect(() => {
        if (formData.program_id) {
            const prog = programs.find(p => p.id === formData.program_id);
            setSelectedProgram(prog);
            if (prog) {
                setFormData(prev => ({ 
                    ...prev, 
                    total_amount: Number(prog.price).toFixed(2) 
                }));
            }
        }
    }, [formData.program_id, programs]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            
            // Auto-update status if paid amount >= total amount
            if (name === 'paid_amount' || name === 'total_amount') {
                const total = Number(newData.total_amount) || 0;
                const paid = Number(newData.paid_amount) || 0;
                if (paid >= total && total > 0) {
                    newData.payment_status = 'Paid';
                } else {
                    newData.payment_status = 'Unpaid';
                }
            }
            
            return newData;
        });
    };

    const handlePaymentStatusChange = (status: "Paid" | "Unpaid") => {
        setFormData(prev => {
            let paid = prev.paid_amount;
            if (status === 'Paid') paid = prev.total_amount;
            if (status === 'Unpaid') paid = "0";
            
            return {
                ...prev,
                payment_status: status,
                paid_amount: paid
            };
        });
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (['total_amount', 'discount', 'paid_amount'].includes(name)) {
            const num = Number(value);
            if (!isNaN(num)) {
                setFormData(prev => ({ ...prev, [name]: num.toFixed(2) }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const termName = terms.find(t => t.term_id === formData.term_id)?.term_name || "Unknown Term";
            
            await addEnrollment({
                student_id: student.student_id,
                term: termName,
                term_id: formData.term_id,
                class_id: formData.class_id,
                start_session: Number(formData.start_session),
                
                total_amount: Number(formData.total_amount),
                discount: Number(formData.discount),
                paid_amount: Number(formData.paid_amount),
                
                // Add-ons
                has_uniform: addons.uniform,
                uniform_fee: addons.uniform ? Number(addons.uniformFee) : 0,
                has_book: addons.book,
                book_fee: addons.book ? Number(addons.bookFee) : 0,
                
                // Double check status on submit
                payment_status: Number(formData.paid_amount) >= Number(formData.total_amount) ? 'Paid' : 'Unpaid',
                payment_type: formData.payment_type as any,
                enrollment_status: 'Active',
                payment_due_date: formData.payment_due_date
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to enroll student");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Filter classes by selected program
    const filteredClasses = classes.filter(c => c.programId === formData.program_id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                 
                 {/* Header */}
                 <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                             <BookOpen size={24} />
                         </div>
                         <div>
                             <h2 className="text-xl font-black text-slate-800">New Enrollment</h2>
                             <p className="text-sm font-medium text-slate-500">
                                 Enrolling <span className="text-indigo-600 font-bold">{student.student_name}</span>
                             </p>
                         </div>
                     </div>
                     <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                         <X size={24} />
                     </button>
                 </div>

                 <form onSubmit={handleSubmit} className="p-8 space-y-8">
                     
                     {/* Row 1: Term & Branch */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Academic Term</label>
                             <select 
                                name="term_id" 
                                value={formData.term_id} 
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                             >
                                 <option value="">Select Term</option>
                                 {terms.map(t => (
                                     <option key={t.term_id} value={t.term_id}>
                                         {t.term_name} {t.status === 'Active' ? '(Active)' : ''}
                                     </option>
                                 ))}
                             </select>
                         </div>
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Campus Branch</label>
                             <select 
                                name="branch_id" 
                                value={formData.branch_id} 
                                onChange={handleInputChange}
                                required
                                disabled={!!student.branch_id}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                             >
                                 <option value="">Select Branch</option>
                                 {branches.map(b => (
                                     <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                 ))}
                             </select>
                         </div>
                     </div>

                     {/* Row 2: Program & Class */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Program</label>
                             <select 
                                name="program_id" 
                                value={formData.program_id} 
                                onChange={handleInputChange}
                                required
                                disabled={!formData.branch_id}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 transition-all disabled:opacity-50"
                             >
                                 <option value="">Select Program</option>
                                 {programs.map(p => (
                                     <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                                 ))}
                             </select>
                         </div>
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Class</label>
                             <select 
                                name="class_id" 
                                value={formData.class_id} 
                                onChange={handleInputChange}
                                required
                                disabled={!formData.program_id}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 transition-all disabled:opacity-50"
                             >
                                 <option value="">Select Class</option>
                                 {filteredClasses.map(c => (
                                     <option key={c.class_id} value={c.class_id}>
                                         {`${c.className} ${c.days?.length ? c.days.map(d => d.slice(0, 3)).join(', ') : ''}${c.startTime ? `(${c.startTime}-${c.endTime})` : ''}`.trim()}
                                     </option>
                                 ))}
                             </select>
                         </div>
                     </div>

                     <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Start Session</label>
                         <input 
                            type="number"
                            name="start_session"
                            value={formData.start_session}
                            onChange={handleInputChange}
                            required
                            placeholder="e.g. 1"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-50 focus:border-indigo-100 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                         />
                     </div>

                     {/* Add-ons Section */}
                     {formData.program_id && (
                         <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                             <div className="flex items-center gap-3 mb-2">
                                 <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                     <PlusCircle size={16} />
                                 </div>
                                 <h3 className="font-bold text-slate-700">Program Add-ons (Optional)</h3>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {/* Uniform */}
                                 <div className={`p-4 rounded-xl border transition-all ${addons.uniform ? 'bg-white border-blue-200 shadow-sm' : 'bg-transparent border-slate-200'}`}>
                                     <div className="flex items-center justify-between mb-3">
                                         <label className="flex items-center gap-2 cursor-pointer">
                                             <input 
                                                 type="checkbox" 
                                                 checked={addons.uniform}
                                                 onChange={(e) => {
                                                     const checked = e.target.checked;
                                                     setAddons(prev => ({ ...prev, uniform: checked }));
                                                     setFormData(prev => ({
                                                         ...prev,
                                                         total_amount: (Number(prev.total_amount) + (checked ? Number(addons.uniformFee) : -Number(addons.uniformFee))).toFixed(2)
                                                     }));
                                                 }}
                                                 className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                             />
                                             <span className="font-bold text-sm text-slate-700">Include Uniform</span>
                                         </label>
                                     </div>
                                     {addons.uniform && (
                                         <div className="flex items-center gap-2">
                                             <span className="text-sm font-bold text-slate-400">$</span>
                                             <input 
                                                 type="number"
                                                 step="0.01"
                                                 value={addons.uniformFee}
                                                 onChange={(e) => {
                                                     const val = e.target.value;
                                                     const diff = Number(val) - Number(addons.uniformFee);
                                                     setAddons(prev => ({ ...prev, uniformFee: val }));
                                                     setFormData(prev => ({
                                                         ...prev,
                                                         total_amount: (Number(prev.total_amount) + diff).toFixed(2)
                                                     }));
                                                 }}
                                                 onBlur={(e) => {
                                                     const num = Number(e.target.value);
                                                     if (!isNaN(num)) setAddons(prev => ({ ...prev, uniformFee: num.toFixed(2) }));
                                                 }}
                                                 className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700 focus:border-blue-400"
                                                 placeholder="0.00"
                                             />
                                         </div>
                                     )}
                                 </div>

                                 {/* Book */}
                                 <div className={`p-4 rounded-xl border transition-all ${addons.book ? 'bg-white border-blue-200 shadow-sm' : 'bg-transparent border-slate-200'}`}>
                                     <div className="flex items-center justify-between mb-3">
                                         <label className="flex items-center gap-2 cursor-pointer">
                                             <input 
                                                 type="checkbox" 
                                                 checked={addons.book}
                                                 onChange={(e) => {
                                                     const checked = e.target.checked;
                                                     setAddons(prev => ({ ...prev, book: checked }));
                                                     setFormData(prev => ({
                                                         ...prev,
                                                         total_amount: (Number(prev.total_amount) + (checked ? Number(addons.bookFee) : -Number(addons.bookFee))).toFixed(2)
                                                     }));
                                                 }}
                                                 className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                             />
                                             <span className="font-bold text-sm text-slate-700">Include Books</span>
                                         </label>
                                     </div>
                                     {addons.book && (
                                         <div className="flex items-center gap-2">
                                             <span className="text-sm font-bold text-slate-400">$</span>
                                             <input 
                                                 type="number"
                                                 step="0.01"
                                                 value={addons.bookFee}
                                                 onChange={(e) => {
                                                     const val = e.target.value;
                                                     const diff = Number(val) - Number(addons.bookFee);
                                                     setAddons(prev => ({ ...prev, bookFee: val }));
                                                     setFormData(prev => ({
                                                         ...prev,
                                                         total_amount: (Number(prev.total_amount) + diff).toFixed(2)
                                                     }));
                                                 }}
                                                 onBlur={(e) => {
                                                     const num = Number(e.target.value);
                                                     if (!isNaN(num)) setAddons(prev => ({ ...prev, bookFee: num.toFixed(2) }));
                                                 }}
                                                 className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700 focus:border-blue-400"
                                                 placeholder="0.00"
                                             />
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Payment Section */}
                     <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
                         <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                                 <CreditCard size={16} />
                             </div>
                             <h3 className="font-bold text-slate-700">Payment Details</h3>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Total Fee ($)</label>
                                 <input 
                                    name="total_amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.total_amount}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700"
                                 />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Discount ($)</label>
                                 <input 
                                    name="discount"
                                    type="number"
                                    step="0.01"
                                    value={formData.discount}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700"
                                 />
                             </div>
                         </div>

                         <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Status</label>
                            <div className="flex bg-white p-1 rounded-xl border border-slate-100">
                                {['Unpaid', 'Paid'].map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => handlePaymentStatusChange(status as any)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                            formData.payment_status === status 
                                            ? 'bg-slate-800 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Amount Paid ($)</label>
                                 <input 
                                    name="paid_amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.paid_amount}
                                    onChange={(e) => {
                                        handleInputChange(e);
                                    }}
                                    onBlur={handleBlur}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700"
                                 />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Type</label>
                                 <select 
                                    name="payment_type"
                                    value={formData.payment_type}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700"
                                 >
                                     <option value="Cash">Cash</option>
                                     <option value="ABA">ABA</option>
                                 </select>
                             </div>
                         </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Due Date</label>
                             <input 
                                type="date"
                                name="payment_due_date"
                                value={formData.payment_due_date}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700"
                             />
                         </div>
                     </div>

                     {/* Actions */}
                     <div className="flex gap-4 pt-4">
                         <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                         >
                             Cancel
                         </button>
                         <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                         >
                             {submitting ? <Loader2 className="animate-spin" /> : <><Check size={20} /> Confirm Enrollment</>}
                         </button>
                     </div>

                 </form>
             </div>
        </div>
    )
}
