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
import { Student, Class, Enrollment, Branch } from "@/lib/types";
import { subscribeToStudents, subscribeToClasses, subscribeToEnrollments, addEnrollment, deleteEnrollment, updateClass, deleteClass } from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { Term } from "@/lib/types";

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

function ClassCard({ cls, enrollments, onClick, onEdit, onDelete, branchName }: { cls: Class, enrollments: Enrollment[], onClick: () => void, onEdit: () => void, onDelete: () => void, branchName: string }) {
  const router = useRouter();
  const activeEnrollments = enrollments.filter(e => e.class_id === cls.class_id);
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
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete Class"
                >
                    <Trash2 size={14} />
                </button>
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

function ClassListRow({ cls, enrollments, onClick, onEdit, onDelete, branchName }: { cls: Class, enrollments: Enrollment[], onClick: () => void, onEdit: () => void, onDelete: () => void, branchName: string }) {
  const activeEnrollments = enrollments.filter(e => e.class_id === cls.class_id);
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
              <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(); }}
                 className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                 title="Delete Class"
              >
                  <Trash2 size={14} />
              </button>
           </div>
       </div>
    </div>
  );
}


function EnrollmentCard({ enrollment, onRemove, onViewInvoice }: { enrollment: Enrollment; onRemove: () => void; onViewInvoice: () => void }) {
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
               onClick={(e) => { e.stopPropagation(); onRemove(); }}
               className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
            >
               <Trash2 size={16} />
            </button>
            
            <button 
               onClick={(e) => { e.stopPropagation(); onViewInvoice(); }}
               className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
               title="View Invoice"
            >
               <Printer size={16} />
            </button>
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
    const unsubStudents = subscribeToStudents(setStudents);
    const unsubClasses = subscribeToClasses(setClasses);
    const unsubEnrollments = subscribeToEnrollments((data) => {
        setEnrollments(data);
        setLoading(false);
    });
    const unsubBranches = branchService.subscribe(setBranches);
    const unsubPrograms = programService.subscribe(setPrograms);
    const unsubTerms = termService.subscribe(setTerms);

    return () => { 
        unsubStudents(); 
        unsubClasses(); 
        unsubEnrollments(); 
        unsubBranches();
        unsubPrograms();
        unsubTerms();
    };
  }, []);

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
        result = result.filter(c => c.programId === filterProgram);
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
  }, [classes, searchQuery, filterBranch, filterProgram]);

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
                            onClick={() => setShowAddModal(true)}
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

            {/* MODAL: ADD STUDENT */}
            {showAddModal && (
                <div 
                    onClick={() => setShowAddModal(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                    >
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Enroll Student</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1">Add student to class and set payment</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleAddStudent} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Select Student</label>
                                    <div className="relative">
                                        <select 
                                            required 
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none"
                                            onChange={(e) => setSelectedStudentIds([e.target.value])}
                                        >
                                            <option value="">Choose Student...</option>
                                            {availableStudents.map(s => (
                                                <option key={s.student_id} value={s.student_id}>{s.student_name} ({s.student_code})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                     <Input label="Total Amount" type="number" name="total_amount" required defaultValue={getProgramPrice} />
                                     <Input label="Discount" type="number" name="discount" defaultValue={0} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <Input label="Paid Amount" type="number" name="paid_amount" required defaultValue={0} />
                                     <Select label="Payment Type" name="payment_type">
                                         <option value="Cash">Cash</option>
                                         <option value="ABA">ABA PayWay</option>
                                     </Select>
                                </div>
                                <Input label="Payment Due Date (Optional)" type="date" name="payment_expired" />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 rounded-xl text-slate-400 font-bold text-xs hover:bg-slate-50 transition-all">Cancel</button>
                                <button disabled={isSubmitting} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center gap-2">
                                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                    <span>Enroll Student</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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
                               {programs
                                   .filter(p => !filterBranch || p.branchId === filterBranch)
                                   .map(p => (
                                   <option key={p.id} value={p.id}>{p.name}</option>
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
        if (!selectedBranchId) {
            setPrograms([]);
            return;
        }
        const unsubscribe = programService.subscribe(setPrograms);
        return () => unsubscribe();
    }, [selectedBranchId]);

    // Filter programs by branch if applicable
    const filteredPrograms = programs.filter(p => !p.branchId || p.branchId === selectedBranchId);

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
            c.startTime === data.startTime &&
            c.endTime === data.endTime &&
            normalizeDays(c.days) === newDaysIdx
        );

        if (isDuplicate) {
             setMsg("A class with this name, schedule, and branch already exists.");
             setLoading(false);
             return;
        }

        const payload = {
            ...data,
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Select Program</label>
                    <div className="relative">
                        <select 
                            name="programId" 
                            required 
                            disabled={!selectedBranchId}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none disabled:opacity-50"
                        >
                            <option value="">{selectedBranchId ? 'Select Curricula...' : 'Choose Branch First'}</option>
                            {filteredPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <Input label="Class Name" name="className" required placeholder="e.g. Morning A" />
                
                {/* Custom Days Dropdown */}
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
                     <Input label="Max Student" name="maxStudents" type="number" defaultValue={20} />
                     <Input label="Total Sessions" name="totalSessions" type="number" defaultValue={60} />
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

    // Form Stats
    const [selectedBranchId, setSelectedBranchId] = useState(cls.branchId || "");
    const [programId, setProgramId] = useState(cls.programId || "");
    const [selectedDays, setSelectedDays] = useState<string[]>(
        Array.isArray(cls.days) ? cls.days : typeof cls.days === 'string' ? (cls.days as string).split(',').map(s => s.trim()) : []
    );

    useEffect(() => {
        const unsub = branchService.subscribe(setBranches);
        const unsubP = programService.subscribe(setPrograms);
        return () => { unsub(); unsubP(); };
    }, []);

    // Filter programs
    const filteredPrograms = PROGRAMS.filter(p => !p.branchId || p.branchId === selectedBranchId);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        
        try {
            await updateClass(cls.class_id, {
                className: data.className as string,
                days: selectedDays,
                startTime: data.startTime as string,
                endTime: data.endTime as string,
                maxStudents: parseInt(data.maxStudents as string),
                totalSessions: parseInt(data.totalSessions as string),
                branchId: selectedBranchId,
                programId: programId
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
                                    value={programId}
                                    onChange={(e) => setProgramId(e.target.value)}
                                    required 
                                    disabled={!selectedBranchId}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all appearance-none disabled:opacity-50"
                                >
                                    <option value="">{selectedBranchId ? 'Select Curricula...' : 'Choose Branch First'}</option>
                                    {filteredPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <Input label="Class Name" name="className" required defaultValue={cls.className} />
                        
                        {/* Custom Days Dropdown */}
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
