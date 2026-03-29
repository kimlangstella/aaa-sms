"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  ChevronRight, 
  Users, 
  Clock, 
  CreditCard,
  X,
  Check,
  Pencil,
  Loader2, LayoutGrid, LayoutList, Building2, Globe, Phone, MapPin, School, ArrowLeft, ArrowRight, User, Wallet, Landmark, Calendar, CalendarCheck, ChevronDown, Printer
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Student, Class, Enrollment, Branch, InventoryItem, ProgramAddon } from "@/lib/types";
import { subscribeToStudents, subscribeToClasses, subscribeToEnrollments, addEnrollment, deleteEnrollment, updateClass, deleteClass } from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { inventoryService } from "@/services/inventoryService";
import { getProgramAddons } from "@/services/programAddonService";
import { Term } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { serverTimestamp } from "firebase/firestore";

/* =========================
   TYPES & HELPERS
   ========================= */

// Helper to calculate progress/payment status
const getPaymentStatus = (paid: number, total: number, discount: number = 0) => {
  // If total is 0 (skipped payment details), status is Unpaid
  if (!total || total === 0) return 'Unpaid';

  const finalTotal = Math.max(0, total - discount);
  if (finalTotal === 0) return 'Paid'; // Fully discounted
  
  const percentage = (paid / finalTotal) * 100;
  return percentage >= 100 ? 'Paid' : 'Unpaid';
};

/* =========================
   COMPONENTS
   ========================= */

function ClassCard({ cls, enrollments, onClick, onEdit, onDelete, branchName, role }: { cls: Class, enrollments: Enrollment[], onClick: () => void, onEdit: () => void, onDelete: () => void, branchName: string, role?: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const activeEnrollments = enrollments.filter(e => e.class_id === cls.class_id && (e.enrollment_status === 'Active' || e.enrollment_status === 'Hold'));
  const count = activeEnrollments.length;
  const capacity = cls.maxStudents || 0;
  const isFull = capacity > 0 && count >= capacity;
  const width = capacity > 0 ? (count / capacity) * 100 : 0;

  const handleViewAttendance = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/admin/attendance?branchId=${cls.branchId || ''}&programId=${cls.programId || ''}&classId=${cls.class_id}`);
  };

  return (
    <div onClick={onClick} className="bg-white/60 backdrop-blur-md rounded-[1.75rem] p-6 border border-white/50 shadow-sm hover:shadow-xl hover:shadow-indigo-100/30 hover:scale-[1.02] hover:border-indigo-100 transition-all cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden active:scale-95">
       <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white flex-shrink-0 group-hover:rotate-6 shadow-inner">
                   <Users size={20} />
              </div>
              <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 break-words tracking-tight">{cls.className}</h3>
                  <div className="flex flex-col gap-1.5 mt-2">
                       <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                          <Calendar size={12} className="flex-shrink-0 text-slate-300" />
                          <span className="truncate">{Array.isArray(cls.days) ? cls.days.join(" • ") : cls.days}</span>
                       </div>
                       {(cls.startTime && cls.endTime) && (
                           <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                              <Clock size={12} className="flex-shrink-0 text-slate-300" />
                              <span className="truncate">{cls.startTime} - {cls.endTime}</span>
                           </div>
                       )}
                       <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 bg-indigo-50/50 border border-indigo-100/30 px-2.5 py-1 rounded-lg w-fit mt-1">
                          <Building2 size={10} className="flex-shrink-0" />
                          <span className="truncate uppercase tracking-widest leading-none">{branchName}</span>
                       </div>
                  </div>
              </div>
          </div>
          
          <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border ${isFull ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-50 shadow-md'}`}>
             {isFull ? 'FULL' : 'OPEN'}
          </div>
       </div>

       <div className="space-y-4">
          <div className="flex justify-between items-end">
              <div>
                  <span className="text-2xl font-black text-slate-900">{count}</span>
                  <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-wider">Students</span>
              </div>
              <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target: {capacity}</span>
              </div>
          </div>
          
          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
             <div 
               className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-rose-500' : 'bg-indigo-500'}`} 
               style={{ width: `${width}%` }}
             ></div>
          </div>

          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex -space-x-2">
                 {activeEnrollments.slice(0, 3).map((e, i) => (
                     <div key={`${e.enrollment_id}-${i}`} className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[9px] text-slate-500 font-bold overflow-hidden">
                         {e.student?.image_url ? <img src={e.student.image_url} className="w-full h-full object-cover" /> : e.student?.student_name?.charAt(0)}
                     </div>
                 ))}
                 {count > 3 && (
                     <div className="w-7 h-7 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[9px] text-slate-400 font-bold">
                         +{count - 3}
                     </div>
                 )}
              </div>
              
              <div className="flex items-center gap-1">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    title="Edit Class"
                >
                    <Pencil size={14} />
                </button>
                {profile?.role === 'superAdmin' && (
                    <button 
                       onClick={(e) => { e.stopPropagation(); onDelete(); }}
                       className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                       title="Delete Class"
                    >
                       <Trash2 size={14} />
                    </button>
                )}
                <button 
                    onClick={handleViewAttendance}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    title="View Attendance"
                >
                    <CalendarCheck size={14} />
                </button>
              </div>
          </div>
       </div>
    </div>
  );
}

function ClassListRow({ cls, enrollments, onClick, onEdit, onDelete, branchName, role }: { cls: Class, enrollments: Enrollment[], onClick: () => void, onEdit: () => void, onDelete: () => void, branchName: string, role?: string }) {
  const { profile } = useAuth();
  const activeEnrollments = enrollments.filter(e => e.class_id === cls.class_id && (e.enrollment_status === 'Active' || e.enrollment_status === 'Hold'));
  const count = activeEnrollments.length;
  const capacity = cls.maxStudents || 0;
  const isFull = capacity > 0 && count >= capacity;

  return (
    <div onClick={onClick} className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-sm hover:shadow-lg hover:shadow-indigo-100/20 transition-all cursor-pointer group flex items-center justify-between gap-6 active:scale-[0.99]">
       <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white flex-shrink-0">
               <Users size={18} />
          </div>
          <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{cls.className}</h3>
              <div className="flex items-center gap-4 mt-1">
                   <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <Calendar size={12} className="text-slate-300" />
                      <span>{Array.isArray(cls.days) ? cls.days.join(" • ") : cls.days}</span>
                   </div>
                   {(cls.startTime && cls.endTime) && (
                       <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <Clock size={12} className="text-slate-300" />
                          <span>{cls.startTime} - {cls.endTime}</span>
                       </div>
                   )}
                   <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{branchName}</span>
              </div>
          </div>
       </div>

       <div className="flex items-center gap-8">
           <div className="flex flex-col items-center">
               <span className="text-sm font-black text-slate-800">{count} / {capacity}</span>
               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Students</span>
           </div>
           
           <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isFull ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {isFull ? 'FULL' : 'OPEN'}
           </div>

           <div className="flex items-center gap-1 pr-2">
              <button 
                 onClick={(e) => { e.stopPropagation(); onEdit(); }}
                 className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-amber-600 hover:bg-amber-50 transition-all"
                 title="Edit Class"
              >
                  <Pencil size={14} />
              </button>
              {profile?.role === 'superAdmin' && (
                  <button 
                     onClick={(e) => { e.stopPropagation(); onDelete(); }}
                     className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                     title="Delete Class"
                  >
                      <Trash2 size={14} />
                  </button>
              )}
           </div>
       </div>
    </div>
  );
}


function EnrollmentCard({ enrollment, onRemove, onViewInvoice, role }: { enrollment: Enrollment; onRemove: () => void; onViewInvoice: () => void; role?: string }) {
  const { profile } = useAuth();
  const student = enrollment.student;
  const isPaidAmount = getPaymentStatus(enrollment.paid_amount || 0, enrollment.total_amount || 0, enrollment.discount || 0) === 'Paid';
  
  const status = (enrollment.payment_status === 'Paid' || isPaidAmount) ? 'Paid' : 'Unpaid';
  const statusColor = status === 'Paid' ? 'emerald' : 'rose';

  if (!student) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 transition-all gap-4">
       <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden">
             {student.image_url ? (
                 <img src={student.image_url} alt="" className="w-full h-full object-cover" />
             ) : (
                 student.student_name.charAt(0)
             )}
          </div>
          <div>
             <h4 className="font-bold text-slate-800 text-sm">{student.student_name}</h4>
             <p className="text-[10px] text-slate-400 font-bold">ID: {student.student_code} • Session {enrollment.start_session || 1}</p>
          </div>
       </div>
       
       <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
          <div className="flex gap-4 text-right">
             <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                 <p className="font-bold text-slate-800 text-sm">${enrollment.total_amount?.toLocaleString() || '0'}</p>
             </div>
             <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</p>
                 <p className={`font-bold text-sm ${isPaidAmount ? 'text-emerald-600' : 'text-amber-600'}`}>${enrollment.paid_amount?.toLocaleString() || '0'}</p>
             </div>
             <div className="hidden sm:block">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                 <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border bg-${statusColor}-50 text-${statusColor}-600 border-${statusColor}-100`}>
                    {status}
                 </div>
              </div>
           </div>
          
          <div className="flex items-center gap-1">
            
            <button 
               onClick={(e) => { e.stopPropagation(); onViewInvoice(); }}
               className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-bold"
               title="View Invoice"
            >
               <Printer size={16} />
            </button>

            {profile?.role === 'superAdmin' && (
              <button 
                 onClick={(e) => { e.stopPropagation(); onRemove(); }}
                 className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all font-bold"
                 title="Remove Student"
              >
                 <Trash2 size={16} />
              </button>
            )}
          </div>
       </div>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
       <input 
          {...props}
          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-medium"
       />
    </div>
  )
}

function Select({ label, children, ...props }: { label: string, children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
       <select
         {...props}
         className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer"
       >
          {children}
       </select>
    </div>
  )
}

/* =========================
   MAIN ENROLLMENT PAGE
========================= */

export default function EnrollmentsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  // Global State (HMR Trigger)
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const [showAddClassModal, setShowAddClassModal] = useState(tab === 'add-class');
  const [showFullWarning, setShowFullWarning] = useState(false);


  useEffect(() => {
    setShowAddClassModal(tab === 'add-class');
  }, [tab]);

  const handleTabChange = (toAddClass: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (toAddClass) {
        params.set('tab', 'add-class');
    } else {
        params.delete('tab');
    }
    router.push(`/admin/enrollments?${params.toString()}`);
  };

  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverStudentIds, setRolloverStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const [viewInvoiceEnrollment, setViewInvoiceEnrollment] = useState<Enrollment | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [filterDay, setFilterDay] = useState("");

  // Custom Dropdown State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]); // Multi-select
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState(""); // Internal search for dropdown
  const studentInputRef = useRef<HTMLInputElement>(null);

  // Individual Payment State
  const [studentPayments, setStudentPayments] = useState<Record<string, { 
      total_amount: number, 
      discount: number, 
      paid_amount: number, 
      payment_type: string, 
      payment_expired: string,
      start_session: number,
      include_next_term: boolean
  }>>({});

  // Helper to get program price
  const getProgramPrice = useMemo(() => {
      if (!selectedClass || !selectedClass.programId) return 0;
      const program = programs.find((p: any) => p.id === selectedClass.programId); 
      return Number(program?.price || 0);
  }, [selectedClass, programs]);

  // Helper to calculate fees dynamically
  const calculateFees = useCallback((startSession: number, includeNextTerm: boolean) => {
      if (!selectedClass) return 0;
      
      const program = programs.find((p: any) => p.id === selectedClass.programId);
      const totalSessions = selectedClass.totalSessions || 1; 
      
      // Use fee from program if available (User Request)
      let pricePerSession = 0;
      if (program?.session_fee) {
          pricePerSession = Number(program.session_fee);
      } else if (program?.pricePerSession) {
           pricePerSession = Number(program.pricePerSession);
      } else {
          const price = Number(program?.price || 0);
          pricePerSession = price / totalSessions;
      }
      
      const remainingSessions = Math.max(0, totalSessions - startSession + 1);
      const currentTermFee = remainingSessions * pricePerSession;
      
      const nextTermFee = includeNextTerm ? Number(program?.price || 0) : 0;
      
      return Math.ceil(currentTermFee + nextTermFee); 
  }, [selectedClass, programs]);

  // Update payment details when students are selected
  useEffect(() => {
      setStudentPayments(prev => {
          const newPayments = { ...prev };
          
          // Remove payments for deselected students
          Object.keys(newPayments).forEach(id => {
              if (!selectedStudentIds.includes(id)) {
                  delete newPayments[id];
              }
          });

          // Add default payment for new students
          selectedStudentIds.forEach(id => {
              if (!newPayments[id]) {
                  const defaultStartSession = 1;
                  const defaultIncludeNextTerm = false;

                  newPayments[id] = {
                      total_amount: calculateFees(defaultStartSession, defaultIncludeNextTerm),
                      discount: 0,
                      paid_amount: 0,
                      payment_type: 'Cash',
                      payment_expired: '',
                      start_session: defaultStartSession,
                      include_next_term: defaultIncludeNextTerm
                  };
              }
          });
          
          return newPayments;
      });
  }, [selectedStudentIds, calculateFees]);

  useEffect(() => {
    if (!profile) return;

    const branchIds: string[] = []; // Fetch all data regardless of role (admin/superAdmin)

    const unsubStudents = subscribeToStudents(setStudents, branchIds);
    const unsubClasses = subscribeToClasses(setClasses, branchIds);
    const unsubEnrollments = subscribeToEnrollments((data) => {
        setEnrollments(data);
        setLoading(false);
    }, branchIds);
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    const unsubPrograms = programService.subscribe(setPrograms);
    const unsubTerms = termService.subscribe(setTerms, branchIds);

    return () => { 
        unsubStudents(); 
        unsubClasses(); 
        unsubEnrollments(); 
        unsubBranches();
        unsubPrograms();
        unsubTerms();
    };
  }, [profile]);

  // Filtered Classes for Grid
  const filteredClasses = useMemo(() => {
    let result = classes;

    // Search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(c => c.className.toLowerCase().includes(q));
    }

    // Filter Branch
    if (filterBranch) {
        result = result.filter(c => c.branchId === filterBranch);
    }

    // Filter Program
    if (filterProgram) {
        const matchingProgramIds = programs.filter(p => p.name === filterProgram).map(p => p.id);
        result = result.filter(c => matchingProgramIds.includes(c.programId) || c.program_name === filterProgram);
    }

    // Filter Day
    if (filterDay) {
        result = result.filter(c => {
            const days: any = c.days;
            if (Array.isArray(days)) {
                return days.some((d: string) => d.toLowerCase() === filterDay.toLowerCase());
            }
            if (typeof days === 'string') {
                 return days.toLowerCase() === filterDay.toLowerCase();
            }
            return false;
        });
    }

    return result;
  }, [classes, searchQuery, filterBranch, filterProgram, filterDay]);

  // Get the active term for default display
  const activeTerm = useMemo(() => terms.find(t => t.status === 'Active'), [terms]);
  
  // Use filterTerm if set, otherwise default to active term
  const displayTermId = filterTerm || activeTerm?.term_id || '';
  const displayTermName = terms.find(t => t.term_id === displayTermId)?.term_name || '';

  // Filter enrollments by term (Active or Selected) for Class Card counts
  const termEnrollments = useMemo(() => {
     if (filterTerm) {
         return enrollments.filter(e => e.term_id === filterTerm);
     }
     if (activeTerm) {
         return enrollments.filter(e => e.term_id === activeTerm.term_id || e.term === activeTerm.term_name);
     }
     return enrollments;
  }, [enrollments, filterTerm, activeTerm]);

  const classRoster = useMemo(() => {
    if (!selectedClass) return [];
    
    // Get all enrollments for this class in the selected/active term
    const classEnrollments = enrollments
        .filter(e => e.class_id === selectedClass.class_id)
        .filter(e => {
            // Match by term_id OR legacy term name
            if (!displayTermId) return true;
            return e.term_id === displayTermId || e.term === displayTermName;
        })
        .filter(e => e.enrollment_status === 'Active' || e.enrollment_status === 'Hold') // Active and Hold students
        .map(e => ({ ...e, student: students.find(s => s.student_id === e.student_id) }))
        .filter(e => e.student); // Ensure student exists
    
    // Group by student_id to avoid duplicates
    const uniqueByStudent = new Map<string, typeof classEnrollments[0]>();
    classEnrollments.forEach(enrollment => {
        const key = enrollment.student_id;
        if (!uniqueByStudent.has(key)) {
            uniqueByStudent.set(key, enrollment);
        }
    });
    
    return Array.from(uniqueByStudent.values());
  }, [selectedClass, enrollments, students, displayTermId, displayTermName]);

  // Filter students for dropdown
  const availableStudents = useMemo(() => {
    // console.log("availableStudents Check:", { selectedClass: selectedClass?.className, totalStudents: students.length, query: studentSearchQuery });
    if (!selectedClass) return [];

    // Get IDs of students already enrolled in this class/term (Active, Hold, Completed)
    // We exclude 'Dropped' so they can be re-enrolled if needed
    const enrolledStudentIds = enrollments
        .filter(e => 
            e.class_id === selectedClass.class_id &&
            // Check term matching
            (displayTermId ? (e.term_id === displayTermId || e.term === displayTermName) : true) &&
            // Filter out dropped students (they should appear in dropdown)
            e.enrollment_status !== 'Dropped'
        )
        .map(e => e.student_id);

    // Exclude already enrolled students
    const unenrolled = students.filter(s => !enrolledStudentIds.includes(s.student_id));
    
    if (!studentSearchQuery) return unenrolled;
    const q = studentSearchQuery.toLowerCase();
    // Search by name (first name included) or code
    return unenrolled.filter(s => s.student_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q));
  }, [students, enrollments, selectedClass, displayTermId, displayTermName, studentSearchQuery]);

  const toggleStudent = (id: string) => {
      setSelectedStudentIds(prev => 
          prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
      );
  };

  async function handleAddStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedClass || selectedStudentIds.length === 0) return;

    setIsSubmitting(true);
    try {
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        
        // Use selected term from filter, or find the current active term
        const selectedTermId = filterTerm || terms.find(t => t.status === 'Active')?.term_id || '';
        const selectedTermName = terms.find(t => t.term_id === selectedTermId)?.term_name || '';
        
        // Loop through all selected students and enroll them
        // Loop through all selected students and enroll them
        const enrollPromises = selectedStudentIds.map(studentId => {
            const payment = studentPayments[studentId] || { 
                total_amount: 0, discount: 0, paid_amount: 0, payment_type: 'Cash', payment_expired: '' 
            };
            
            return addEnrollment({
                class_id: selectedClass.class_id,
                student_id: studentId,
                start_session: Number(data.start_session) || 1,
                total_amount: Number(payment.total_amount) || 0,
                discount: Number(payment.discount) || 0,
                paid_amount: Number(payment.paid_amount) || 0,
                payment_status: getPaymentStatus(Number(payment.paid_amount), Number(payment.total_amount), Number(payment.discount)) as any,
                payment_type: payment.payment_type as any || 'Cash',
                payment_due_date: payment.payment_expired as string,
                payment_date: new Date().toISOString(),
                term_id: selectedTermId,
                term: selectedTermName
            });
        });

        await Promise.all(enrollPromises);
        
        setShowAddModal(false);
        setSelectedStudentIds([]);
        setStudentSearchQuery("");
    } catch (err) {
        alert("Failed to enroll students.");
    } finally {
        setIsSubmitting(false);
    }
  }

  async function handleRemoveStudent(enrollmentId: string) {
    if (profile?.role !== 'superAdmin') {
        alert("Only Super Administrators can remove students from classes.");
        return;
    }
    if (!confirm("Are you sure you want to remove this student from the class?")) return;
    try {
        await deleteEnrollment(enrollmentId);
    } catch (err) {
        alert("Failed to remove student.");
    }
  }

  // Move students from inactive term to active term
  async function handleRollover() {
    if (!selectedClass || !activeTerm || rolloverStudentIds.length === 0) return;
    
    setIsSubmitting(true);
    try {
        // Create new enrollments for selected students in the active term
        const enrollPromises = rolloverStudentIds.map(studentId => {
            // Find the original enrollment from the old term
            const oldEnrollment = classRoster.find(r => r.student_id === studentId);
            
            return addEnrollment({
                class_id: selectedClass.class_id,
                student_id: studentId,
                start_session: 1, // Start fresh in new term
                total_amount: oldEnrollment?.total_amount || 0,
                discount: oldEnrollment?.discount || 0,
                paid_amount: 0, // Reset payment for new term
                payment_status: 'Unpaid' as any,
                payment_type: oldEnrollment?.payment_type || 'Cash' as any,
                payment_due_date: '', // Reset for new term
                payment_date: new Date().toISOString(),
                term_id: activeTerm.term_id,
                term: activeTerm.term_name
            });
        });

        await Promise.all(enrollPromises);
        
        setShowRolloverModal(false);
        setRolloverStudentIds([]);
        setFilterTerm(""); // Switch to active term view
        alert(`Successfully moved ${enrollPromises.length} students to ${activeTerm.term_name}!`);
    } catch (err) {
        alert("Failed to move students.");
    } finally {
        setIsSubmitting(false);
    }
  }

  async function handleDeleteClass(classId: string) {
      if (profile?.role !== 'superAdmin') {
          alert("Only Super Administrators can delete classes.");
          return;
      }
      if (!confirm("Are you sure you want to delete this class? This action cannot be undone and will delete all associated enrollments.")) return;
      try {
          await deleteClass(classId);
      } catch (err) {
          alert("Failed to delete class.");
      }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  /* RENDER: CLASS DETAIL VIEW */
  if (selectedClass) {
    // Check if viewing an inactive term (for rollover)
    const isViewingInactiveTerm = filterTerm && terms.find(t => t.term_id === filterTerm)?.status === 'Inactive';
    const canRollover = isViewingInactiveTerm && activeTerm && classRoster.length > 0;
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedClass(null); setFilterTerm(""); }} className="w-10 h-10 rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-white transition-all">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selectedClass.className}</h1>
                        <p className="text-slate-400 font-bold text-xs mt-1">
                            {displayTermName ? `${displayTermName} Roster` : 'Class Roster'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Term Filter */}
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={filterTerm}
                            onChange={(e) => setFilterTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-100 bg-white text-slate-700 font-semibold text-xs focus:border-indigo-200 outline-none transition-all min-w-[180px]"
                        >
                            <option value="">Current Term ({activeTerm?.term_name || 'None'})</option>
                            {terms
                                .filter(t => t.term_id !== activeTerm?.term_id)
                                .map(t => (
                                <option key={t.term_id} value={t.term_id}>{t.term_name} ({t.status})</option>
                            ))}
                        </select>
                    </div>
                                        {/* Transfer Button - only show when viewing inactive term */}
                     {canRollover && (
                         <button 
                             onClick={() => {
                                 setRolloverStudentIds(classRoster.map(r => r.student_id));
                                 setShowRolloverModal(true);
                             }}
                             className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center gap-2"
                         >
                             <ArrowRight size={16} />
                             <span>Move to {activeTerm?.term_name}</span>
                         </button>
                     )}
                    
                    {/* Add Student - only when viewing active term */}
                    {!filterTerm && (
                        <button 
                            onClick={() => {
                                const capacity = Number(selectedClass.maxStudents) || 0;
                                if (capacity > 0 && classRoster.length >= capacity) {
                                    setShowFullWarning(true);
                                } else {
                                    setShowAddModal(true);
                                }
                            }}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            <span>Add Student</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900">{classRoster.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</p>
                    </div>
                </div>
                {/* Add more stats if needed */}
            </div>

            {/* Roster List */}
            <div className="space-y-4">
                {classRoster.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold">No students enrolled yet.</p>
                    </div>
                ) : (
                    classRoster.map(enrollment => (
                        <EnrollmentCard 
                            key={enrollment.enrollment_id} 
                            enrollment={enrollment} 
                            onRemove={() => handleRemoveStudent(enrollment.enrollment_id!)} 
                            onViewInvoice={() => setViewInvoiceEnrollment(enrollment)}
                        />
                    ))
                )}
            </div>

            {showAddModal && (
                <EnrollmentFormModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    selectedClass={selectedClass}
                    availableStudents={availableStudents}
                    activeTerm={activeTerm}
                    terms={terms}
                    programPrice={getProgramPrice}
                    displayTermId={displayTermId}
                    currentCount={classRoster.length}
                    onSuccess={() => {
                        setShowAddModal(false);
                        setSelectedStudentIds([]);
                        setStudentSearchQuery("");
                    }}
                />
            )}

            {/* TRANSFER MODAL */}
            {showRolloverModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                     <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden">
                         <div className="p-6 border-b border-slate-100 bg-slate-50">
                             <h2 className="text-xl font-bold text-slate-900">Transfer Students</h2>
                             <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Move students to {activeTerm?.term_name}</p>
                         </div>
                        
                        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                            {classRoster.map(item => (
                                <label key={item.student_id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-100 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={rolloverStudentIds.includes(item.student_id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setRolloverStudentIds(prev => [...prev, item.student_id]);
                                            } else {
                                                setRolloverStudentIds(prev => prev.filter(id => id !== item.student_id));
                                            }
                                        }}
                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600"
                                    />
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                                        {item.student?.image_url ? <img src={item.student.image_url} className="w-full h-full object-cover" /> : item.student?.student_name?.charAt(0)}
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{item.student?.student_name}</span>
                                </label>
                            ))}
                        </div>
                        
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setShowRolloverModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-slate-100 text-sm">Cancel</button>
                             <button 
                                 onClick={handleRollover} 
                                 disabled={isSubmitting || rolloverStudentIds.length === 0} 
                                 className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                             >
                                 {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={18} />}
                                 <span>Move Students (Unpaid)</span>
                             </button>
                        </div>
                    </div>
                </div>
            )}
            {viewInvoiceEnrollment && (
                <InvoiceModal 
                    enrollment={viewInvoiceEnrollment} 
                    onClose={() => setViewInvoiceEnrollment(null)} 
                />
            )}

            {showFullWarning && selectedClass && (
                <ClassFullWarningModal 
                    capacity={Number(selectedClass.maxStudents) || 0}
                    onClose={() => setShowFullWarning(false)}
                />
            )}
        </div>
    );
  }

   /* RENDER: ENROLLMENT VIEW */
  return (
    <div className="space-y-6 pb-20 max-w-[1800px] mx-auto px-4 md:px-0">
       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500">
                  <Users size={20} className="lg:scale-125" />
              </div>
              <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                    {showAddClassModal ? 'Create Class' : 'Enrollments Management'}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Operations</span>
                      <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-slate-300"></div>
                      <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        {showAddClassModal ? 'New Roster Entry' : 'Roster Board'}
                      </span>
                  </div>
              </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
             {!showAddClassModal && (
                <>
                    <button 
                       onClick={() => handleTabChange(true)}
                       className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                    >
                       <Plus size={18} />
                       <span>Create Class</span>
                    </button>

                    <div className="flex bg-white/60 backdrop-blur-md rounded-[1.25rem] sm:rounded-[1.5rem] p-1 border border-slate-200/50 shadow-sm w-full sm:w-auto justify-center">
                       <button 
                          onClick={() => setView('grid')} 
                          className={`p-2 sm:p-3 rounded-[0.9rem] sm:rounded-[1.125rem] transition-all ${view === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                          title="Grid View"
                       >
                          <LayoutGrid size={18} className="sm:hidden" />
                          <LayoutGrid size={20} className="hidden sm:block" />
                      </button>
                       <button 
                          onClick={() => setView('list')} 
                          className={`p-2 sm:p-3 rounded-[0.9rem] sm:rounded-[1.125rem] transition-all ${view === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                          title="List View"
                       >
                          <LayoutList size={18} className="sm:hidden" />
                          <LayoutList size={20} className="hidden sm:block" />
                      </button>
                    </div>
                </>
             )}
          </div>
       </div>

       {showAddClassModal ? (
           <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                             <Plus size={16} className="sm:hidden" />
                             <Plus size={20} className="hidden sm:block" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">Create New Class</h2>
                    </div>
               </div>
               <div className="p-4 sm:p-8">
                   <CreateClassForm onCancel={() => handleTabChange(false)} onSuccess={() => handleTabChange(false)} />
               </div>
           </div>
        ) : (
            <div className="space-y-4 sm:space-y-6">
               {/* Search and Filters Toolbar */}
               <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                   {/* Search */}
                    <div className="relative w-full md:w-[300px] group">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-5 pr-12 py-3 bg-white border border-slate-200 rounded-[1.25rem] font-bold text-xs sm:text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400 shadow-sm"
                        />
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                            <Search className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                        </div>
                    </div>

                   <div className="flex flex-wrap items-center gap-3">
                       {/* Branch Filter */}
                       <div className="relative">
                           <select
                               value={filterBranch}
                               onChange={(e) => setFilterBranch(e.target.value)}
                               className="pl-4 pr-10 py-2.5 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer min-w-[160px]"
                           >
                               <option value="">All Branches</option>
                               {branches.map(b => (
                                   <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                               ))}
                           </select>
                           <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                       </div>

                       {/* Program Filter */}
                       <div className="relative">
                           <select
                               value={filterProgram}
                               onChange={(e) => setFilterProgram(e.target.value)}
                               className="pl-4 pr-10 py-2.5 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer min-w-[160px]"
                           >
                               <option value="">All Programs</option>
                               {Array.from(new Set(programs
                                   .filter(p => !filterBranch || p.branchId === filterBranch)
                                   .map(p => p.name)))
                                   .map((name: any) => (
                                   <option key={name} value={name}>{name}</option>
                               ))}
                           </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>

                        {/* Day Filter */}
                        <div className="relative">
                            <select
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                                className="pl-4 pr-10 py-2.5 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer min-w-[140px]"
                            >
                                <option value="">Select Day</option>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
               </div>

               {/* Class Grid */}
               {/* Class Grid/List Toggle */}
               {view === 'grid' ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredClasses.map(cls => (
                         <ClassCard 
                            key={cls.class_id} 
                            cls={cls} 
                            enrollments={termEnrollments} 
                            onClick={() => setSelectedClass(cls)} 
                            onEdit={() => setEditingClass(cls)}
                            onDelete={() => handleDeleteClass(cls.class_id)}
                            branchName={branches.find(b => b.branch_id === cls.branchId)?.branch_name || 'Unknown'}
                         />
                      ))}
                   </div>
               ) : (
                   <div className="space-y-3">
                      {filteredClasses.map(cls => (
                         <ClassListRow 
                            key={cls.class_id} 
                            cls={cls} 
                            enrollments={termEnrollments} 
                            onClick={() => setSelectedClass(cls)} 
                            onEdit={() => setEditingClass(cls)}
                            onDelete={() => handleDeleteClass(cls.class_id)}
                            branchName={branches.find(b => b.branch_id === cls.branchId)?.branch_name || 'Unknown'}
                         />
                      ))}
                   </div>
               )}
           </div>
        )}

      {/* MODAL: EDIT CLASS */}
      {editingClass && (
          <EditClassModal 
              cls={editingClass} 
              onClose={() => setEditingClass(null)} 
              onSuccess={() => setEditingClass(null)} 
           />
      )}

    </div>
  );
}

// Reuse CreateClassForm logic but adapted for Modal
function CreateClassForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [programs, setPrograms] = useState<any[]>([]);
    const [selectedProgramName, setSelectedProgramName] = useState("");
    const [selectedProgramId, setSelectedProgramId] = useState("");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    const [classes, setClasses] = useState<Class[]>([]);

    useEffect(() => {
        const unsub = branchService.subscribe(setBranches);
        const unsubClasses = subscribeToClasses(setClasses);
        return () => {
            unsub();
            unsubClasses();
        };
    }, []);

    useEffect(() => {
        // Reset program selection when branch changes
        setSelectedProgramName("");
        setSelectedProgramId("");
        
        if (!selectedBranchId) {
            setPrograms([]);
            return;
        }
        const unsubscribe = programService.subscribe(setPrograms, [selectedBranchId]);
        return () => unsubscribe();
    }, [selectedBranchId]);

    // Unique program names for the dropdown (legacy logic removed)

    // Deduplicate program versions for display (same name, price, sessions)
    const uniquePrograms = programs.filter((p, index, self) => 
        index === self.findIndex((t) => (
            t.name === p.name && 
            t.price === p.price && 
            (t.total_sessions || t.durationSessions || 0) === (p.total_sessions || p.durationSessions || 0)
        ))
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(""); // Clear previous messages
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        
        // Validation: Check for duplicate class
        const normalizeDays = (d: string | string[]) => {
            if (Array.isArray(d)) return d.sort().join(',');
            return typeof d === 'string' ? d : '';
        };

        const newDaysIdx = [...selectedDays].sort().join(',');
        
        const isDuplicate = classes.some(c => 
            c.branchId === selectedBranchId &&
            c.className.trim().toLowerCase() === (data.className as string).trim().toLowerCase() &&
            c.programId === selectedProgramId &&
            c.startTime === data.startTime &&
            c.endTime === data.endTime &&
            normalizeDays(c.days) === newDaysIdx
        );

        if (isDuplicate) {
             setMsg("A class with this name, program, and schedule already exists in this branch.");
             setLoading(false);
             return;
        }

        const payload = {
            ...data,
            programId: selectedProgramId,
            days: selectedDays,
            branchId: selectedBranchId
        };

        try {
            await fetch("/api/classes", { method: "POST", body: JSON.stringify(payload) });
            onSuccess();
        } catch (e) {
            setMsg("Failed to open class.");
        } finally {
            setLoading(false);
        }
    }

    const toggleDay = (day: string) => {
        setSelectedDays(prev => 
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {msg && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                        <X size={16} />
                    </div>
                    <p className="text-sm font-bold">{msg}</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Select Branch</label>
                    <div className="relative">
                        <select 
                            value={selectedBranchId} 
                            onChange={(e) => setSelectedBranchId(e.target.value)} 
                            required 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none"
                        >
                            <option value="">Select Branch...</option>
                            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Program</label>
                    <div className="relative">
                        <select 
                            value={selectedProgramName}
                            onChange={(e) => {
                                const name = e.target.value;
                                setSelectedProgramName(name);
                                const matching = programs.filter(p => p.name === name);
                                if (matching.length > 0) {
                                    setSelectedProgramId(matching[0].id);
                                } else {
                                    setSelectedProgramId("");
                                }
                            }}
                            required 
                            disabled={!selectedBranchId}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none disabled:opacity-50"
                        >
                            <option value="">{selectedBranchId ? 'Select Program...' : 'Choose Branch First'}</option>
                            {Array.from(new Set(programs.map(p => p.name))).map((name: any) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <Input label="Class Name" name="className" required placeholder="e.g. Morning A" />
                
                {/* Custom Days Dropdown (Reverted from Checkboxes) */}
                <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Schedule</label>
                    <div className="relative group">
                         <button
                            type="button"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-left text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all flex justify-between items-center"
                         >
                            <span className={selectedDays.length ? 'text-slate-900' : 'text-slate-400'}>
                                {selectedDays.length > 0 ? selectedDays.join(", ") : "Select Days"}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 group-focus-within:rotate-180 transition-transform" />
                         </button>
                         <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 grid grid-cols-2 gap-2 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                             {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                 <button
                                    key={day}
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); toggleDay(day); }}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center justify-between ${selectedDays.includes(day) ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                 >
                                    {day}
                                    {selectedDays.includes(day) && <Check size={14} />}
                                 </button>
                             ))}
                         </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <Input label="Start Time" name="startTime" type="time" required />
                     <Input label="End Time" name="endTime" type="time" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <Input label="Max Student" name="maxStudents" type="number" defaultValue={10} />
                     <Input label="Total Sessions" name="totalSessions" type="number" defaultValue={11} />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                 <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-50 transition-all">
                    Cancel
                </button>
                <button disabled={loading} className="px-8 py-3 bg-orange-600 text-white rounded-xl font-bold text-xs hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 disabled:opacity-50 flex items-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    <span>Create Class</span>
                </button>
            </div>
        </form>
    )
}

function InvoiceModal({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
    const total = enrollment.total_amount || 0;
    const discount = enrollment.discount || 0;
    const paid = enrollment.paid_amount || 0;
    const due = Math.max(0, total - discount - paid);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                         <h2 className="text-xl font-black text-slate-900">INVOICE</h2>
                         <p className="text-sm font-bold text-slate-400">#{enrollment.enrollment_id?.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                        <h3 className="font-bold text-slate-800">Authentic Advanced Academy</h3>
                        <p className="text-xs text-slate-500">Phnom Penh, Cambodia</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Bill To</p>
                            <p className="font-bold text-slate-800 text-lg">{enrollment.student?.student_name}</p>
                            <p className="text-xs text-slate-500">{enrollment.student?.student_code}</p>
                        </div>
                         <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase">Class</p>
                            <p className="font-bold text-slate-800">{enrollment.term}</p>
                            <p className="text-xs text-slate-500">Session {enrollment.start_session}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                             <span className="font-bold text-slate-600">Tuition Fee</span>
                             <span className="font-bold text-slate-900">${total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                             <span className="font-bold text-slate-600">Discount</span>
                             <span className="font-bold text-indigo-600">-${discount.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div className="flex justify-between text-base">
                             <span className="font-black text-slate-800">Total Due</span>
                             <span className="font-black text-slate-900">${(total - discount).toLocaleString()}</span>
                        </div>
                        {(enrollment.payment_due_date || enrollment.payment_expired) && (
                            <div className="flex justify-between text-xs pt-1">
                                <span className="font-bold text-slate-400">Due Date</span>
                                <span className="font-bold text-slate-600">{new Date(enrollment.payment_due_date || enrollment.payment_expired || '').toLocaleDateString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                             <span className="font-bold text-emerald-600">Paid Amount</span>
                             <span className="font-bold text-emerald-600">-${paid.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div className="flex justify-between text-lg">
                             <span className="font-black text-slate-800">Balance Due</span>
                             <span className="font-black text-rose-600">${due.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 print:hidden">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200 text-sm">Close</button>
                    <button onClick={() => window.print()} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 text-sm">
                        <Printer size={16} />
                        Print Invoice
                    </button>
                </div>
            </div>
            
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .fixed, .fixed * {
                        visibility: visible;
                    }
                    .fixed {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        backdrop-filter: none;
                        padding: 0;
                    }
                    .fixed > div {
                        box-shadow: none;
                        max-width: 100%;
                        width: 100%;
                    }
                    .print\\:hidden {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}

function EditClassModal({ cls, onClose, onSuccess }: { cls: Class, onClose: () => void, onSuccess: () => void }) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [ PROGRAMS, setPrograms ] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [allClasses, setAllClasses] = useState<Class[]>([]);

    useEffect(() => {
        const unsub = subscribeToClasses(setAllClasses);
        return () => unsub();
    }, []);

    // Form Stats
    const [selectedBranchId, setSelectedBranchId] = useState(cls.branchId || "");
    const [selectedProgramName, setSelectedProgramName] = useState(cls.program_name || "");
    const [selectedProgramId, setSelectedProgramId] = useState(cls.programId || "");
    const [selectedDays, setSelectedDays] = useState<string[]>(
        Array.isArray(cls.days) ? cls.days : typeof cls.days === 'string' ? (cls.days as string).split(',').map(s => s.trim()) : []
    );

    useEffect(() => {
        const unsub = branchService.subscribe(setBranches);
        const unsubP = programService.subscribe(setPrograms, selectedBranchId ? [selectedBranchId] : undefined);
        return () => { unsub(); unsubP(); };
    }, [selectedBranchId]);

    // Resolve programId by name if it's missing (legacy data support)
    useEffect(() => {
        if (!selectedProgramId && cls.program_name && PROGRAMS.length > 0) {
            const match = PROGRAMS.find(p => p.name === cls.program_name);
            if (match) setSelectedProgramId(match.id);
        }
    }, [PROGRAMS, selectedProgramId, cls.program_name]);

    // Handle branch change relative to original
    useEffect(() => {
        if (selectedBranchId && selectedBranchId !== cls.branchId) {
            setSelectedProgramId("");
        }
    }, [selectedBranchId, cls.branchId]);

    // Deduplicate program versions for display (same name, price, sessions)
    const uniquePROGRAMS = PROGRAMS.filter((p, index, self) => 
        index === self.findIndex((t) => (
            t.name === p.name && 
            t.price === p.price && 
            (t.total_sessions || t.durationSessions || 0) === (p.total_sessions || p.durationSessions || 0)
        ))
    );

    // Versions
    const programVersions = PROGRAMS.filter(p => p.name === selectedProgramName);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg("");
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        // Duplicate Check
        const normalizeDays = (d: any) => {
            if (Array.isArray(d)) return [...d].sort().join(',');
            if (typeof d === 'string') return d.split(',').map(s => s.trim()).sort().join(',');
            return '';
        };

        const newDaysIdx = [...selectedDays].sort().join(',');

        const isDuplicate = allClasses.some(c => 
            c.class_id !== cls.class_id &&
            c.branchId === selectedBranchId &&
            c.className.trim().toLowerCase() === (data.className as string).trim().toLowerCase() &&
            c.programId === selectedProgramId &&
            c.startTime === data.startTime &&
            c.endTime === data.endTime &&
            normalizeDays(c.days) === newDaysIdx
        );

        if (isDuplicate) {
            setMsg("Another class with the same name and schedule already exists.");
            setLoading(false);
            return;
        }
        
        try {
            await updateClass(cls.class_id, {
                className: data.className as string,
                days: selectedDays,
                startTime: data.startTime as string,
                endTime: data.endTime as string,
                maxStudents: parseInt(data.maxStudents as string),
                totalSessions: parseInt(data.totalSessions as string),
                branchId: selectedBranchId,
                programId: selectedProgramId
            });
            onSuccess();
        } catch (e) {
            setMsg("Failed to update class.");
            alert("Failed to update class");
        } finally {
            setLoading(false);
        }
    }

    const toggleDay = (day: string) => {
        setSelectedDays(prev => 
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <div 
             onClick={onClose}
             className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
             <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
             >
                 <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                               <Pencil size={20} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-900">Edit Class</h2>
                      </div>
                      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
                 </div>
                 
                 <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {msg && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600">
                             <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                                <X size={16} />
                             </div>
                             <p className="text-sm font-bold">{msg}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Branch</label>
                            <div className="relative">
                                <select 
                                    value={selectedBranchId} 
                                    onChange={(e) => setSelectedBranchId(e.target.value)} 
                                    required 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none"
                                >
                                    <option value="">Select Branch...</option>
                                    {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Program</label>
                            <div className="relative">
                                <select 
                                    value={selectedProgramName}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setSelectedProgramName(name);
                                        const matching = PROGRAMS.filter(p => p.name === name);
                                        if (matching.length > 0) {
                                            setSelectedProgramId(matching[0].id);
                                        } else {
                                            setSelectedProgramId("");
                                        }
                                    }}
                                    required 
                                    disabled={!selectedBranchId}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none disabled:opacity-50"
                                >
                                    <option value="">{selectedBranchId ? 'Select Program...' : 'Choose Branch First'}</option>
                                    {Array.from(new Set(PROGRAMS.map(p => p.name))).map((name: any) => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <Input label="Class Name" name="className" required defaultValue={cls.className} />
                        
                        {/* Custom Days Dropdown (Reverted) */}
                        <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Schedule</label>
                            <div className="relative group">
                                <button
                                    type="button"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-left text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all flex justify-between items-center"
                                >
                                    <span className={selectedDays.length ? 'text-slate-900' : 'text-slate-400'}>
                                        {selectedDays.length > 0 ? selectedDays.join(", ") : "Select Days"}
                                    </span>
                                    <ChevronDown size={16} className="text-slate-400 group-focus-within:rotate-180 transition-transform" />
                                </button>
                                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 grid grid-cols-2 gap-2 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); toggleDay(day); }}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center justify-between ${selectedDays.includes(day) ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >
                                            {day}
                                            {selectedDays.includes(day) && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <Input label="Start Time" name="startTime" type="time" required defaultValue={cls.startTime} />
                             <Input label="End Time" name="endTime" type="time" required defaultValue={cls.endTime} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <Input label="Max Student" name="maxStudents" type="number" defaultValue={cls.maxStudents} />
                             <Input label="Total Sessions" name="totalSessions" type="number" defaultValue={cls.totalSessions} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                         <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-50 transition-all">
                            Cancel
                        </button>
                        <button disabled={loading} className="px-8 py-3 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 transition-all shadow-xl shadow-amber-100 disabled:opacity-50 flex items-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
             </div>
        </div>
    );
}

function ClassFullWarningModal({ onClose, capacity }: { onClose: () => void, capacity: number }) {
    return (
        <div 
             onClick={onClose}
             className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div 
                 onClick={(e) => e.stopPropagation()}
                 className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="p-8 text-center space-y-4">
                     <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
                         <Users size={32} />
                     </div>
                     <h2 className="text-xl font-black text-slate-900">Class Limit Reached</h2>
                     <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        This class has reached its maximum capacity of <span className="text-rose-600">{capacity} students</span>.
                        <br/>You cannot add more students at this time.
                     </p>
                     
                     <div className="pt-6">
                         <button 
                            onClick={onClose}
                            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                         >
                            Understood
                         </button>
                     </div>
                </div>
            </div>
        </div>
    );
}

function EnrollmentFormModal({ 
    isOpen, 
    onClose, 
    selectedClass, 
    availableStudents, 
    activeTerm, 
    terms, 
    programPrice, 
    onSuccess,
    displayTermId,
    currentCount = 0
}: any) {
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const studentInputRef = useRef<HTMLInputElement>(null);

    // Add-ons State
    const [addons, setAddons] = useState<ProgramAddon[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    type AddonConfig = {
        addonId: string;
        itemId: string;
        qty: number;
        priceSnapshot: number;
        nameSnapshot: string;
    };
    const [selectedAddons, setSelectedAddons] = useState<Record<string, AddonConfig>>({});

    // Fetch Addons & Inventory
    useEffect(() => {
        let unsubInventory: (() => void) | undefined;
        if (selectedClass?.programId && selectedClass?.branchId) {
            getProgramAddons(selectedClass.programId).then(setAddons);
            unsubInventory = inventoryService.subscribe(setInventoryItems, [selectedClass.branchId]);
        }
        return () => {
            if (unsubInventory) unsubInventory();
        }
    }, [selectedClass]);

    // Format initial selected addons based on non-optional
    useEffect(() => {
        if (addons.length > 0 && inventoryItems.length > 0 && Object.keys(selectedAddons).length === 0) {
            const initial: Record<string, AddonConfig> = {};
            addons.forEach(a => {
                if (!a.isOptional) {
                    const item = inventoryItems.find(i => i.id === a.itemId);
                    if (item) {
                        initial[a.id] = {
                            addonId: a.id,
                            itemId: item.id,
                            qty: a.defaultQty || 1,
                            priceSnapshot: item.price,
                            nameSnapshot: a.label || item.name
                        };
                    }
                }
            });
            setSelectedAddons(initial);
        }
    }, [addons, inventoryItems]);

    const addonsTotal = useMemo(() => {
        return Object.values(selectedAddons).reduce((sum, a) => sum + (a.priceSnapshot * a.qty), 0);
    }, [selectedAddons]);

    const toggleAddon = (addon: ProgramAddon, item: InventoryItem, checked: boolean) => {
        if (checked) {
            setSelectedAddons(prev => ({
                ...prev,
                [addon.id]: {
                    addonId: addon.id,
                    itemId: item.id,
                    qty: addon.defaultQty || 1,
                    priceSnapshot: item.price,
                    nameSnapshot: addon.label || item.name
                }
            }));
        } else {
            setSelectedAddons(prev => {
                const next = { ...prev };
                delete next[addon.id];
                return next;
            });
        }
    };
    
    const updateAddonQty = (addonId: string, qty: number) => {
        if (qty < 1) return;
        setSelectedAddons(prev => ({
            ...prev,
            [addonId]: {
                ...prev[addonId],
                qty
            }
        }));
    };

    // Global Payment State
    const [totalAmount, setTotalAmount] = useState(programPrice);
    const [discount, setDiscount] = useState(0);
    const [paidAmount, setPaidAmount] = useState(programPrice);
    const [paymentType, setPaymentType] = useState('Cash');
    const [dueDate, setDueDate] = useState('');

    // Per-Student Overrides
    type PaymentDetails = {
        total: number;
        discountPercent: number; // Storing percentage directly for better input handling
        discountAmount: number; // Calculated amount
        paid: number;
        type: string;
        dueDate: string;
    };
    const [overrides, setOverrides] = useState<Record<string, PaymentDetails>>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    // Update global total if prop changes or addons change
    useEffect(() => {
        setTotalAmount(programPrice + addonsTotal);
    }, [programPrice, addonsTotal]);

    // Auto-set Global Due Date from Active Term
    useEffect(() => {
        if (activeTerm?.end_date) {
            setDueDate(activeTerm.end_date.split('T')[0]);
        }
    }, [activeTerm]);

    // Auto-calculate Global Paid Amount
    useEffect(() => {
        setPaidAmount(Math.max(0, totalAmount - (totalAmount * (discount / 100))));
    }, [totalAmount, discount]);

    const toggleStudent = (id: string) => {
        setSelectedStudentIds(prev => {
            const newIds = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
            if (!newIds.includes(id)) {
                // Cleanup override if removing
                const newOverrides = { ...overrides };
                delete newOverrides[id];
                setOverrides(newOverrides);
                if (editingId === id) setEditingId(null);
            }
            return newIds;
        });
    };

    const getStudentPaymentDetails = (id: string) => {
        if (overrides[id]) return overrides[id];
        return {
            total: totalAmount,
            discountPercent: discount,
            discountAmount: (totalAmount * discount) / 100,
            paid: paidAmount,
            type: paymentType,
            dueDate: dueDate
        };
    };

    const handleSaveOverride = (id: string, details: PaymentDetails) => {
        setOverrides(prev => ({ ...prev, [id]: details }));
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0) {
            alert("Please select at least one student");
            return;
        }

        const capacity = Number(selectedClass.maxStudents) || 0;
        if (capacity > 0 && (currentCount + selectedStudentIds.length) > capacity) {
            alert(`Cannot enroll students. Class capacity of ${capacity} exceeded.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const currentTermString = new Date().getFullYear() + "_T" + (Math.floor(new Date().getMonth() / 3) + 1);
            let termId = displayTermId || activeTerm?.term_id || '';
            let termName = "";
            if (termId) {
                termName = terms.find((t: any) => t.term_id === termId)?.term_name || "";
            } else {
                 termName = activeTerm?.term_name || currentTermString;
            }

            const enrollPromises = selectedStudentIds.map(studentId => {
                 const details = getStudentPaymentDetails(studentId);
                 return addEnrollment({
                    class_id: selectedClass.class_id,
                    student_id: studentId,
                    start_session: 1,
                    total_amount: Number(details.total),
                    discount: Number(details.discountAmount),
                    paid_amount: Number(details.paid),
                    payment_status: Number(details.paid) >= Number(details.total - details.discountAmount) ? 'Paid' : 'Unpaid',
                    payment_type: details.type as any,
                    payment_due_date: Number(details.paid) < Number(details.total - details.discountAmount) ? (details.dueDate || null) : null, 
                    payment_expired: details.dueDate || null,
                    enrollment_status: 'Active',
                    term: termName,
                    term_id: termId,
                    branchId: selectedClass.branchId || '',
                    programId: selectedClass.programId || '',
                    enrolled_at: serverTimestamp(),
                    selectedAddons: Object.values(selectedAddons),
                });
            });

            await Promise.all(enrollPromises);

            // Decrement Stock for selected addons
            const addonList = Object.values(selectedAddons);
            if (addonList.length > 0) {
                const stockPromises = addonList.map(addon => 
                    inventoryService.decrementStock(addon.itemId, addon.qty * selectedStudentIds.length)
                );
                await Promise.all(stockPromises);
            }

            onSuccess();
        } catch (error) {
            console.error("Error enrolling students:", error);
            alert("Failed to enroll students. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            >
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Enroll Student</h2>
                        <p className="text-xs font-bold text-slate-400 mt-1">Add student to class and set payment</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>
                
                <form onSubmit={handleAddStudent} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                    
                    {/* 1. Student Selection Dropdown */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Add Students</label>
                        {studentDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setStudentDropdownOpen(false)} />}
                        <div className="relative z-50">
                            <button
                                type="button"
                                onClick={() => setStudentDropdownOpen(!studentDropdownOpen)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-left text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all flex justify-between items-center hover:bg-slate-100"
                            >
                                <span className="text-slate-500">
                                    {selectedStudentIds.length > 0 ? "Add more students..." : "Select Students..."}
                                </span>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${studentDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {studentDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[300px] animate-in fade-in zoom-in-95 duration-200 ring-4 ring-slate-200/50">
                                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
                                        <div className="relative group">
                                            <input 
                                                ref={studentInputRef}
                                                type="text" 
                                                placeholder="Search..." 
                                                value={studentSearchQuery}
                                                onChange={(e) => setStudentSearchQuery(e.target.value)}
                                                className="w-full pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all bg-white"
                                                autoFocus
                                            />
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                                        {availableStudents.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 text-xs font-bold">No students found.</div>
                                        ) : (
                                            availableStudents.map((s: any) => (
                                                <div 
                                                    key={s.student_id} 
                                                    onClick={() => toggleStudent(s.student_id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedStudentIds.includes(s.student_id) ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}
                                                >
                                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${selectedStudentIds.includes(s.student_id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                        {selectedStudentIds.includes(s.student_id) && <Check size={12} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                         {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-slate-400">{s.student_name.charAt(0)}</span>}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-700">{s.student_name}</p>
                                                        <span className="text-[10px] font-bold text-slate-400">{s.student_code}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Program Addons Selection */}
                    {addons.length > 0 && inventoryItems.length > 0 && (
                        <div className="space-y-3 p-5 rounded-xl border border-indigo-100 bg-indigo-50/30">
                            <label className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                Program Add-ons
                            </label>
                            <div className="grid grid-cols-1 gap-3">
                                {addons.map(addon => {
                                    const item = inventoryItems.find(i => i.id === addon.itemId);
                                    if (!item) return null;
                                    const isSelected = !!selectedAddons[addon.id];
                                    return (
                                        <div key={addon.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${isSelected ? 'border-indigo-300 bg-white shadow-sm' : 'border-slate-200 bg-white/50 opacity-70'}`}>
                                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                                                <input 
                                                    type="checkbox" 
                                                    disabled={!addon.isOptional}
                                                    checked={isSelected}
                                                    onChange={(e) => toggleAddon(addon, item, e.target.checked)}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{addon.label || item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs font-bold text-indigo-600">${item.price}</span>
                                                        {addon.isRecommended && <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded uppercase">Recommended</span>}
                                                        {!addon.isOptional && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Required</span>}
                                                    </div>
                                                </div>
                                            </label>
                                            {isSelected && (
                                                <div className="flex items-center gap-2 border-l border-slate-100 pl-4 w-24 ml-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span>
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        value={selectedAddons[addon.id].qty}
                                                        onChange={(e) => updateAddonQty(addon.id, Number(e.target.value))}
                                                        className="w-full px-2 py-1 text-center rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 bg-slate-50"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {addonsTotal > 0 && (
                                <div className="flex justify-between items-center pt-3 border-t border-indigo-100/50">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Add-ons Total</span>
                                    <span className="text-sm font-black text-indigo-700">${addonsTotal.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. Selected Students List (Cards) */}
                    {selectedStudentIds.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                Selected Students ({selectedStudentIds.length})
                            </label>
                            
                            <div className="grid gap-3">
                                {selectedStudentIds.map(id => {
                                    const student = availableStudents.find((s: any) => s.student_id === id);
                                    if (!student) return null;
                                    const isEditing = editingId === id;
                                    const payment = getStudentPaymentDetails(id);
                                    const hasOverride = !!overrides[id];

                                    return (
                                        <div key={id} className={`rounded-xl border transition-all ${isEditing ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white shadow-lg' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                                            {/* Card Header (Always Visible) */}
                                            <div className="p-3 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-100">
                                                    {student.image_url ? <img src={student.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-400">{student.student_name.charAt(0)}</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{student.student_name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{student.student_code}</span>
                                                        {hasOverride && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Custom Payment</span>}
                                                    </div>
                                                </div>
                                                
                                                {/* Actions */}
                                                {!isEditing ? (
                                                    <div className="flex items-center gap-1">
                                                        <div className="text-right mr-2 hidden sm:block">
                                                            <div className="text-xs font-black text-slate-900">${payment.paid}</div>
                                                            <div className="text-[10px] font-bold text-slate-400">Paid</div>
                                                        </div>
                                                        <button type="button" onClick={() => setEditingId(id)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                                                            {/* Pencil Icon */}
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                                        </button>
                                                        <button type="button" onClick={() => toggleStudent(id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Edit Form (Expanded) */}
                                            {isEditing && (
                                                <div className="p-4 border-t border-indigo-100 bg-indigo-50/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Total</label>
                                                            <input 
                                                                type="number" 
                                                                value={payment.total} 
                                                                onChange={(e) => {
                                                                    const newTotal = Number(e.target.value);
                                                                    const newDiscountAmount = (newTotal * payment.discountPercent) / 100;
                                                                    handleSaveOverride(id, { 
                                                                        ...payment, 
                                                                        total: newTotal,
                                                                        discountAmount: newDiscountAmount,
                                                                        paid: Math.max(0, newTotal - newDiscountAmount) 
                                                                    });
                                                                }}
                                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="space-y-1 relative">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Discount (%)</label>
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    value={payment.discountPercent} 
                                                                    min="0"
                                                                    max="100"
                                                                    onChange={(e) => {
                                                                        const newPercent = Math.min(100, Math.max(0, Number(e.target.value)));
                                                                        const newDiscountAmount = (payment.total * newPercent) / 100;
                                                                        handleSaveOverride(id, { 
                                                                            ...payment, 
                                                                            discountPercent: newPercent,
                                                                            discountAmount: newDiscountAmount,
                                                                            paid: Math.max(0, payment.total - newDiscountAmount) 
                                                                        });
                                                                    }}
                                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-500 outline-none pr-8"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 text-right mt-1">
                                                                -${(payment.discountAmount || 0).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Paid</label>
                                                            <input 
                                                                type="number" 
                                                                value={payment.paid} 
                                                                onChange={(e) => handleSaveOverride(id, { ...payment, paid: Number(e.target.value) })}
                                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                                                            <select 
                                                                value={payment.type} 
                                                                onChange={(e) => handleSaveOverride(id, { ...payment, type: e.target.value })}
                                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-500 outline-none bg-white"
                                                            >
                                                                <option value="Cash">Cash</option>
                                                                <option value="ABA">ABA</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Expired Date (Optional)</label>
                                                        <input 
                                                            type="date" 
                                                            value={payment.dueDate}
                                                            onChange={(e) => handleSaveOverride(id, { ...payment, dueDate: e.target.value })}
                                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:border-indigo-500 outline-none bg-white"
                                                        />
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => {
                                                            const newOverrides = { ...overrides };
                                                            delete newOverrides[id];
                                                            setOverrides(newOverrides);
                                                            setEditingId(null);
                                                        }} className="text-[10px] font-bold text-indigo-600 hover:underline px-2">
                                                            Reset to Default
                                                        </button>
                                                        <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </form>

                <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-white shrink-0">
                    <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button onClick={handleAddStudent} disabled={isSubmitting} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        <span>Enroll {selectedStudentIds.length > 0 ? selectedStudentIds.length : ''} Student{selectedStudentIds.length !== 1 ? 's' : ''}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
