"use client";

import { useEffect, useState, useMemo } from "react";
import { subscribeToStudents, subscribeToClasses, subscribeToEnrollments, updateEnrollment, deleteEnrollment, addEnrollment } from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { termService } from "@/services/termService";
import { programService } from "@/services/programService";
import { inventoryService } from "@/services/inventoryService";
import { Student, Class, Enrollment, Branch, InventoryItem } from "@/lib/types";
import { Search, Loader2, Calendar, FileText, Download, Filter, CheckCircle, ArrowLeft, ChevronDown, ChevronUp, AlertCircle, Users, DollarSign, Eye, Pencil, MoreVertical, CreditCard, X, Plus, BookOpen, Building2, Check } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "@/lib/useAuth";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
   const [branches, setBranches] = useState<Branch[]>([]);
   const [terms, setTerms] = useState<any[]>([]); // Added state
   const [programs, setPrograms] = useState<any[]>([]);
   const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Filters
   const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
   const [selectedTermId, setSelectedTermId] = useState<string>("all"); // Added state
   const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
   const [selectedClassId, setSelectedClassId] = useState<string>("all");
   const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all"); // Added state
   const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState<string>('all');
   const [showFilterPopover, setShowFilterPopover] = useState(false);
   const filterRef = useRef<HTMLDivElement>(null);
   const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    interface ReviewItem {
        enrollment_id: string;
        student_id: string;
        class_id: string;
        programId?: string;
        branchId?: string;
        term_id?: string;
        term_name: string;
        studentName: string;
        studentCode: string;
        studentImage?: string;
        className: string;
        total: number;
        discount: number;
        paid: number;
        newPaid: string | number;
        dueDate: string;
        isNew: boolean;
        includeNextTerm?: boolean;
    }

    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [bulkPayDate, setBulkPayDate] = useState("");

  // History Modal
  const [historyStudent, setHistoryStudent] = useState<any | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Inventory Integration
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [addingItemToEnrollment, setAddingItemToEnrollment] = useState<Enrollment | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
      contentRef: componentRef,
      documentTitle: "Payment-Report"
  });

  async function handleUpdatePayment(enrollmentId: string, paidAmount: number, dueDate?: string) {
       try {
           const enrollment = enrollments.find(e => e.enrollment_id === enrollmentId);
           if (!enrollment) return;
           
           const total = Number(enrollment.total_amount) - Number(enrollment.discount || 0);
           const isPaid = paidAmount >= total;

           await updateEnrollment(enrollmentId, {
               paid_amount: paidAmount,
               payment_status: isPaid ? 'Paid' : 'Unpaid',
               ...(dueDate ? { payment_due_date: dueDate } : {})
           });
       } catch (err) {
           console.error(err);
           alert("Failed to update payment");
       }
  }


   async function handleDelete(id: string) {
      if (profile?.role !== 'superAdmin') {
          alert("Only Super Administrators can delete payment records.");
          return;
      }
      if (!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) return;
      try {
          await deleteEnrollment(id);
      } catch (err) {
          console.error(err);
          alert("Failed to delete record");
      }
   }

   async function performBulkPay() {
       if (reviewItems.length === 0) return;
       
       setLoading(true);
       let count = 0;
       
       try {
           for (const item of reviewItems) {
               if (item.isNew) {
                   // Create new enrollment for future term
                   await addEnrollment({
                       student_id: item.student_id,
                       class_id: item.class_id,
                       programId: item.programId,
                       branchId: item.branchId,
                       term_id: item.term_id,
                       term: item.term_name,
                       total_amount: item.total,
                       discount: item.discount,
                       paid_amount: Number(item.newPaid),
                       payment_status: Number(item.newPaid) >= (item.total - item.discount) ? 'Paid' : 'Unpaid',
                       payment_due_date: item.dueDate,
                       enrollment_status: 'Active',
                       start_session: 1,
                       enrolled_at: new Date().toISOString()
                   });
               } else {
                   // Update existing enrollment
                   await updateEnrollment(item.enrollment_id, {
                       paid_amount: Number(item.newPaid),
                       payment_status: Number(item.newPaid) >= (item.total - item.discount) ? 'Paid' : 'Unpaid',
                       payment_due_date: item.dueDate
                   });
               }
               count++;
           }
           alert(`Successfully processed ${count} payments.`);
           setBulkPayModalOpen(false);
           setSelectedGroups(new Set());
           setReviewItems([]);
       } catch (error) {
           console.error("Bulk pay error:", error);
           alert("Failed to process some payments.");
       } finally {
           setLoading(false);
       }
   }

   function openBulkPayModal() {
       let studentsToReview: Enrollment[] = [];
       
       if (selectedGroups.size > 0) {
           studentsToReview = enrollments.filter(e => {
               const student = students.find(s => s.student_id === e.student_id);
               return student && selectedGroups.has(student.student_code + student.student_name);
           });
       } else if (selectedClassId && selectedClassId !== 'all') {
           studentsToReview = enrollments.filter(e => e.class_id === selectedClassId);
           if (selectedTermId !== 'all') {
               studentsToReview = studentsToReview.filter(e => e.term_id === selectedTermId);
           }
       }

       if (studentsToReview.length === 0) {
           return alert("Please select students or a class first.");
       }

        const items: ReviewItem[] = studentsToReview.map(enr => {
            const student = students.find(s => s.student_id === enr.student_id);
            const cls = classes.find(c => c.class_id === enr.class_id);
            const term = terms.find(t => t.term_id === enr.term_id);
            const total = Number(enr.total_amount) - Number(enr.discount || 0);
            
            return {
                enrollment_id: enr.enrollment_id,
                student_id: enr.student_id,
                class_id: enr.class_id,
                programId: enr.programId || '',
                branchId: enr.branchId || '',
                term_id: enr.term_id || '',
                term_name: enr.term || term?.term_name || 'N/A',
                
                studentName: student?.student_name || 'Unknown',
                studentCode: student?.student_code || 'N/A',
                studentImage: student?.image_url,
                className: cls?.className || 'N/A',
                
                total: Number(enr.total_amount) || 0,
                discount: Number(enr.discount) || 0,
                paid: Number(enr.paid_amount) || 0,
                newPaid: total,
                dueDate: enr.payment_due_date || new Date().toISOString().split('T')[0],
                isNew: false,
                includeNextTerm: (enr as any).include_next_term || false
            };
        });

       setReviewItems(items);
       setBulkPayModalOpen(true);
   }

   const handleAddNextTerm = (studentId: string, currentTermId: string) => {
       // Find items for this student to get details
       const existingItems = reviewItems.filter(item => item.student_id === studentId);
       if (existingItems.length === 0) return;
       
       const lastItem = existingItems[existingItems.length - 1];
       
       // Find current term date range
       const currentTerm = terms.find(t => t.term_id === currentTermId);
       if (!currentTerm) return;
       
       // Find next term after currentTerm.end_date
       const nextTerm = terms
           .filter(t => t.branch_id === lastItem.branchId)
           .filter(t => new Date(t.start_date) >= new Date(currentTerm.end_date))
           .sort((a,b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
           
       if (!nextTerm) {
           return alert("No future term found for this branch.");
       }
       
       // Check if already added to review
       if (reviewItems.some(i => i.student_id === studentId && i.term_id === nextTerm.term_id)) {
           return alert("Next term already added for this student.");
       }

       // Find program for price
       const program = programs.find(p => p.id === lastItem.programId);
       const nextTermPrice = program?.price || lastItem.total;

        const newItem: ReviewItem = {
           enrollment_id: `new-${Date.now()}-${studentId}`,
           student_id: studentId,
           class_id: lastItem.class_id,
           programId: lastItem.programId,
           branchId: lastItem.branchId,
           term_id: nextTerm.term_id,
           term_name: nextTerm.term_name,
           
           studentName: lastItem.studentName,
           studentCode: lastItem.studentCode,
           studentImage: lastItem.studentImage,
           className: lastItem.className,
           
           total: Number(nextTermPrice) || 0,
           discount: 0,
           paid: 0,
           newPaid: Number(nextTermPrice) || 0,
           dueDate: nextTerm.start_date,
           isNew: true
       };
       
       setReviewItems(prev => [...prev, newItem]);
   };

   const handleRemoveReviewItem = (id: string) => {
       setReviewItems(prev => prev.filter(i => i.enrollment_id !== id));
   };

  useEffect(() => {
    if (!profile) return;

    const branchIds: string[] = []; // Both admin and superAdmin see all

     const unsubStudents = subscribeToStudents(setStudents, branchIds);
     const unsubClasses = subscribeToClasses(setClasses, branchIds);
     const unsubBranches = branchService.subscribe(setBranches, branchIds);
     const unsubTerms = termService.subscribe(setTerms); // Added subscription
     const unsubPrograms = programService.subscribe(setPrograms);
    const unsubEnrollments = subscribeToEnrollments((data) => {
        setEnrollments(data);
        setLoading(false);
    }, branchIds);

    return () => { 
         unsubStudents(); 
         unsubClasses(); 
         unsubBranches();
         unsubTerms(); // Added unsubscribe
         unsubPrograms();
         unsubEnrollments(); 
     };
  }, [profile]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearch(searchQuery);
        setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Close popover on click away
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered Classes based on Branch/Program
  const filteredClasses = useMemo(() => {
      let filtered = classes;
      if (selectedBranchId !== 'all') {
          filtered = filtered.filter(c => c.branchId === selectedBranchId);
      }
      if (selectedProgramId !== 'all') {
          // Note: programService returns .id, but class stores .programId
          filtered = filtered.filter(c => c.programId === selectedProgramId);
      }
      return filtered;
  }, [classes, selectedBranchId, selectedProgramId]);

  // Combine data
  const paymentRows = useMemo(() => {
      let filtered = enrollments;

      // Final combined filter
      filtered = filtered.filter(enr => {
          const student = students.find(s => s.student_id === enr.student_id);
          const matchesSearch = !debouncedSearch || 
              student?.student_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              student?.student_code.toLowerCase().includes(debouncedSearch.toLowerCase());
          
           const matchesBranch = selectedBranchId === 'all' || enr.branchId === selectedBranchId;
           const matchesTerm = selectedTermId === 'all' || enr.term_id === selectedTermId; // Added term filter
           const matchesProgram = selectedProgramId === 'all' || enr.programId === selectedProgramId;
           
           // Class filter: if 'all', use filteredClasses, otherwise use specific classId
           const matchesClass = selectedClassId === 'all' 
               ? filteredClasses.map(c => c.class_id).includes(enr.class_id)
               : enr.class_id === selectedClassId;
           
           // Handle enrollment status filter (default to 'Active')
           const enrStatus = enr.enrollment_status || 'Active';
           const matchesStatus = selectedEnrollmentStatus === 'all' || enrStatus === selectedEnrollmentStatus;

           // Payment Status Filter
           const total = Number(enr.total_amount) - Number(enr.discount || 0);
           const isPaid = Number(enr.paid_amount) >= total;
           const matchesPayment = paymentStatusFilter === 'all' || 
               (paymentStatusFilter === 'Paid' && isPaid) || 
               (paymentStatusFilter === 'Unpaid' && !isPaid);

           return matchesSearch && matchesBranch && matchesTerm && matchesProgram && matchesClass && matchesStatus && matchesPayment;
       });

      return filtered.map(enr => {
          const student = students.find(s => s.student_id === enr.student_id);
          const cls = classes.find(c => c.class_id === enr.class_id);
          
          const total = Number(enr.total_amount) - Number(enr.discount || 0);
          const isPaidAmount = Number(enr.paid_amount) >= total;
          const term = terms.find(t => t.term_id === enr.term_id);
          const dueDate = enr.payment_due_date || enr.payment_expired || term?.end_date; 
          
          const today = new Date().toISOString().split('T')[0];
          const isExpired = isPaidAmount && dueDate && today > dueDate;
          
          let status = isPaidAmount ? (isExpired ? 'Unpaid' : 'Paid') : 'Unpaid';
          return {
              id: enr.enrollment_id,
              student_id: enr.student_id,
              studentName: student?.student_name || 'Unknown',
              studentCode: student?.student_code || 'N/A',
              className: cls?.className || 'Unknown',
              total: Number(enr.total_amount) || 0,
              paid: Number(enr.paid_amount) || 0,
              discount: Number(enr.discount) || 0,
              due_date: dueDate,
              status,
               studentImage: student?.image_url,
               term: enr.term
           };
       }).filter(row => 
           row.studentName !== 'Unknown'
       );
   }, [enrollments, students, classes, searchQuery, selectedBranchId, selectedTermId, selectedProgramId, selectedClassId, paymentStatusFilter, selectedEnrollmentStatus, filteredClasses, debouncedSearch]);

  // Group by Student
  const groupedPayments = useMemo(() => {
      const groups: { [key: string]: any } = {};
      
      paymentRows.forEach(row => {
          // Use studentCode as fallback key if ID missing (shouldn't happen)
          const key = row.studentCode + row.studentName; 
          if (!groups[key]) {
              groups[key] = {
                  studentName: row.studentName,
                  studentCode: row.studentCode,
                  studentImage: row.studentImage,
                  items: [],
                  totalFee: 0,
                  totalPaid: 0,
                  totalDiscount: 0
              };
          }
            groups[key].items.push(row);
            groups[key].totalFee += (row.total || 0);
            groups[key].totalPaid += (row.paid || 0);
            groups[key].totalDiscount += (row.discount || 0);

            // Smart Due Date: Find the earliest due date
            if (row.due_date) {
                const currentEarliest = groups[key].earliestDueDate;
                if (!currentEarliest || new Date(row.due_date) < new Date(currentEarliest)) {
                    groups[key].earliestDueDate = row.due_date;
                }
            }
        });

        return Object.values(groups);
  }, [paymentRows]);

  // Paginated Groups
  const totalPages = Math.ceil(groupedPayments.length / itemsPerPage);
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedPayments.slice(start, start + itemsPerPage);
  }, [groupedPayments, currentPage, itemsPerPage]);

  // Calculate Summary Stats
  const summaryStats = useMemo(() => {
      const totalStudents = groupedPayments.length;
      const totalCollected = groupedPayments.reduce((sum, g) => sum + g.totalPaid, 0);
      const totalOutstanding = groupedPayments.reduce((sum, g) => sum + (g.totalFee - g.totalDiscount - g.totalPaid), 0);
      return { totalStudents, totalCollected, totalOutstanding };
  }, [groupedPayments]);
  
  const groupedReview = useMemo(() => {
    const groups: { [key: string]: {
        studentName: string;
        studentCode: string;
        studentImage?: string;
        items: ReviewItem[];
    } } = {};
    
    reviewItems.forEach((item) => {
        const key = item.student_id;
        if (!groups[key]) {
            groups[key] = {
                studentName: item.studentName,
                studentCode: item.studentCode,
                studentImage: item.studentImage,
                items: []
            };
        }
        groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [reviewItems]);

    useEffect(() => {
        if (!profile) return;
        const effectiveBranchIds: string[] = []; // Both admin and superAdmin see all
        const unsub = inventoryService.subscribe(setInventoryItems, effectiveBranchIds);
        return () => unsub();
    }, [profile]);

  if (loading) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  return (
    <div className="max-w-[1800px] mx-auto space-y-4 sm:space-y-6 pb-20 px-4 xl:px-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-8">
            <div className="flex items-center gap-4 sm:gap-6">
                <button 
                    onClick={() => router.back()} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-50 transition-all active:scale-95 group"
                >
                    <ArrowLeft size={18} className="sm:hidden" />
                    <ArrowLeft size={20} className="hidden sm:block group-hover:-translate-x-1 transition-transform" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Payments Tracking</h1>
                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                        <span className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">Financial Records</span>
                        <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-[9px] sm:text-[11px] font-black text-blue-500 uppercase tracking-widest">{groupedPayments.length} Active Students</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={handlePrint}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-xs hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-100 transition-all active:scale-95 group shadow-lg"
                >
                    <Download size={14} className="sm:hidden" />
                    <Download size={16} className="hidden sm:block group-hover:-translate-y-0.5 transition-transform" />
                    <span>Export</span>
                </button>
            </div>
        </div>

        {/* Compact & Unified Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-8 relative">
            {/* Search - Primary Pillar */}
            <div className="relative flex-1 min-w-[300px] group">
                <input 
                    type="text" 
                    placeholder="Search students..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-6 py-4 rounded-[2rem] bg-white border border-slate-100 text-slate-700 font-bold text-sm placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 shadow-sm"
                />
                <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                    <Search className="text-slate-300 group-focus-within:text-indigo-400 transition-colors" size={20} />
                </div>
            </div>

            {/* Unified Filter Toggle */}
            <div className="relative" ref={filterRef}>
                <button 
                    onClick={() => setShowFilterPopover(!showFilterPopover)}
                    className={`h-[58px] px-8 rounded-[2rem] flex items-center gap-3 transition-all border-2 ${showFilterPopover || selectedBranchId !== 'all' || selectedProgramId !== 'all' || paymentStatusFilter !== 'all' || selectedTermId !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-indigo-100' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'} font-black text-[11px] uppercase tracking-widest`}
                >
                    <Filter size={18} />
                    <span>Filters</span>
                    {(selectedBranchId !== 'all' || selectedProgramId !== 'all' || paymentStatusFilter !== 'all' || selectedTermId !== 'all') && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                            {[selectedBranchId, selectedProgramId, paymentStatusFilter, selectedTermId].filter(v => v !== 'all').length}
                        </div>
                    )}
                </button>

                {/* Filter Popover */}
                {showFilterPopover && (
                    <div className="absolute top-full mt-3 right-0 w-[calc(100vw-32px)] sm:w-[320px] bg-white rounded-[2rem] border border-slate-100 shadow-2xl z-[100] p-3 animate-in fade-in zoom-in duration-200">
                        <div className="max-h-[450px] overflow-y-auto custom-scrollbar p-1">
                            <div className="flex items-center justify-between px-3 mb-4">
                                <h3 className="font-black text-[10px] text-slate-900 uppercase tracking-widest">Active Filters</h3>
                                <button 
                                    onClick={() => {
                                        setSelectedBranchId('all');
                                        setSelectedProgramId('all');
                                        setSelectedTermId('all');
                                        setPaymentStatusFilter('all');
                                    }}
                                    className="text-indigo-600 font-bold text-[10px] uppercase hover:underline"
                                >
                                    Clear all
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Branch Section */}
                                <div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1.5">Branch</h4>
                                    <div className="grid grid-cols-1 gap-0.5">
                                        <button
                                            onClick={() => {
                                                setSelectedBranchId('all');
                                                setSelectedProgramId('all');
                                                setSelectedClassId('all');
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                selectedBranchId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <span>All Branch</span>
                                            {selectedBranchId === 'all' && <Check size={14} />}
                                        </button>
                                        {branches.map(b => (
                                            <button
                                                key={b.branch_id}
                                                onClick={() => {
                                                    setSelectedBranchId(selectedBranchId === b.branch_id ? "all" : b.branch_id);
                                                    setSelectedProgramId('all');
                                                    setSelectedClassId('all');
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                    selectedBranchId === b.branch_id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                <span className="truncate">{b.branch_name}</span>
                                                {selectedBranchId === b.branch_id && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100/50 mx-2" />

                                {/* Program Section */}
                                <div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1.5">Program</h4>
                                    <div className="grid grid-cols-1 gap-0.5">
                                        <button
                                            onClick={() => {
                                                setSelectedProgramId('all');
                                                setSelectedClassId('all');
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                selectedProgramId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <span>All Program</span>
                                            {selectedProgramId === 'all' && <Check size={14} />}
                                        </button>
                                        {programs.map(p => {
                                            const pId = p.program_id || p.id;
                                            return (
                                                <button
                                                    key={pId}
                                                    onClick={() => {
                                                        setSelectedProgramId(selectedProgramId === pId ? "all" : pId);
                                                        setSelectedClassId('all');
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                        selectedProgramId === pId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="truncate">{p.program_name || p.name}</span>
                                                    {selectedProgramId === pId && <Check size={14} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100/50 mx-2" />

                                {/* Term Section */}
                                <div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1.5">Academic Term</h4>
                                    <div className="grid grid-cols-1 gap-0.5">
                                        <button
                                            onClick={() => setSelectedTermId('all')}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                selectedTermId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <span>All Term</span>
                                            {selectedTermId === 'all' && <Check size={14} />}
                                        </button>
                                        {terms.map(t => (
                                            <button
                                                key={t.term_id}
                                                onClick={() => setSelectedTermId(selectedTermId === t.term_id ? "all" : t.term_id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                    selectedTermId === t.term_id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                <span className="truncate">{t.term_name}</span>
                                                {selectedTermId === t.term_id && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100/50 mx-2" />

                                {/* Status Section */}
                                <div>
                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1.5">Payment Status</h4>
                                    <div className="grid grid-cols-1 gap-0.5">
                                        <button
                                            onClick={() => setPaymentStatusFilter('all')}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                paymentStatusFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <span>All Status</span>
                                            {paymentStatusFilter === 'all' && <Check size={14} />}
                                        </button>
                                        {['Paid', 'Unpaid'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setPaymentStatusFilter(paymentStatusFilter === status ? "all" : status)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-bold ${
                                                    paymentStatusFilter === status ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                <span>{status}</span>
                                                {paymentStatusFilter === status && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PAID Pillar */}
            <button
                disabled={selectedClassId === 'all' && selectedGroups.size === 0}
                onClick={() => openBulkPayModal()}
                className={`h-[58px] px-10 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 ${ (selectedClassId !== 'all' || selectedGroups.size > 0) ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-slate-50 text-slate-300 border border-slate-100 shadow-none'}`}
            >
                <DollarSign size={20} />
                <span>Paid {selectedGroups.size > 0 ? `(${selectedGroups.size})` : ''}</span>
            </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div ref={componentRef} className="p-2 overflow-x-auto">
                {/* Print Header */}
                <div className="hidden print:block text-center mb-8 pt-4">
                    <h1 className="text-2xl font-bold text-slate-900">Payment Status Report</h1>
                    <p className="text-slate-500">{new Date().toLocaleDateString()}</p>
                    {selectedClassId !== 'all' && <p className="text-sm font-bold mt-1">Class: {classes.find(c => c.class_id === selectedClassId)?.className}</p>}
                </div>

                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                         <tr className="border-b border-slate-100 uppercase tracking-wider text-[11px] font-black text-slate-400">
                            <th className="py-5 px-6 w-10">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={paginatedGroups.length > 0 && paginatedGroups.every(g => selectedGroups.has(g.studentCode + g.studentName))}
                                    onChange={(e) => {
                                        const newSelected = new Set(selectedGroups);
                                        if (e.target.checked) {
                                            paginatedGroups.forEach(g => newSelected.add(g.studentCode + g.studentName));
                                        } else {
                                            paginatedGroups.forEach(g => newSelected.delete(g.studentCode + g.studentName));
                                        }
                                        setSelectedGroups(newSelected);
                                    }}
                                />
                            </th>
                             <th className="py-5 px-6 print:hidden">Actions</th>
                            <th className="py-5 px-6">Student</th>
                            <th className="py-5 px-6">Class</th>
                            <th className="py-5 px-6 text-right">Balance Due</th>
                            <th className="py-5 px-6 text-right">Due Date</th>
                            <th className="py-5 px-6 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedGroups.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">No payments found.</td>
                            </tr>
                        ) : (
                             paginatedGroups.map((group, idx) => (
                                <PaymentGroupRow 
                                    key={idx} 
                                    group={group} 
                                    isSelected={selectedGroups.has(group.studentCode + group.studentName)}
                                    onSelect={(selected) => {
                                        const newSelected = new Set(selectedGroups);
                                        const key = group.studentCode + group.studentName;
                                        if (selected) newSelected.add(key);
                                        else newSelected.delete(key);
                                        setSelectedGroups(newSelected);
                                    }}
                                    onViewHistory={() => setHistoryStudent(group)}
                                    onAddItem={() => {
                                        const unpaidItemRow = group.items.find((item: any) => item.status === 'Unpaid') || group.items[0];
                                        if (unpaidItemRow) {
                                            const enr = enrollments.find(e => e.enrollment_id === unpaidItemRow.id);
                                            if (enr) setAddingItemToEnrollment(enr);
                                        }
                                    }}
                                    onEdit={() => {
                                        const unpaidItem = group.items.find((item: any) => item.status === 'Unpaid') || group.items[0];
                                        if (unpaidItem) {
                                            setEditingPayment(unpaidItem);
                                        }
                                    }}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex justify-end items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition-all"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center transition-all ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Edit Payment Modal */}
        {editingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Update Payment</h2>
                        <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-slate-600"><div className="p-2 hover:bg-slate-100 rounded-full"><Loader2 size={0} className="hidden" /> <span className="text-xl">×</span></div></button>
                    </div>
                    
                    <div className="p-8 space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-slate-400 font-bold border border-slate-200">
                                {editingPayment.studentName.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">{editingPayment.studentName}</h3>
                                <p className="text-xs text-slate-500 font-medium">Total Fee: ${editingPayment.total}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Paid Amount ($)</label>
                                    <button 
                                        onClick={() => {
                                            const input = document.getElementById('modal-paid-amount') as HTMLInputElement;
                                            if (input) input.value = (Number(editingPayment.total) - Number(editingPayment.discount || 0)).toString();
                                        }}
                                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                                    >
                                        Set Full Amount
                                    </button>
                                </div>
                                <input 
                                    type="number" 
                                    defaultValue={editingPayment.paid}
                                    id="modal-paid-amount"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Expiry Date</label>
                                <input 
                                    type="date" 
                                    defaultValue={editingPayment.due_date}
                                    id="modal-due-date"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                             <button 
                                onClick={async () => {
                                    const paidInput = document.getElementById('modal-paid-amount') as HTMLInputElement;
                                    const dateInput = document.getElementById('modal-due-date') as HTMLInputElement;
                                    const newPaid = Number(paidInput.value);
                                    const newDate = dateInput.value;

                                    if (isNaN(newPaid)) return alert("Invalid Amount");
                                    
                                    await handleUpdatePayment(editingPayment.id, newPaid, newDate);
                                    setEditingPayment(null);
                                }}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {/* Bulk Pay Review Modal */}
        {bulkPayModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20 flex flex-col max-h-[90vh]">
                    <div className="px-10 py-8 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Process Payments</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Review and adjust individual student fees</p>
                            </div>
                        </div>
                        <button onClick={() => setBulkPayModalOpen(false)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-all active:scale-90"><X size={20} /></button>
                    </div>

                     <div className="p-10 overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar">
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {groupedReview.map((group) => (
                                <div key={group.studentCode} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300 transition-all hover:shadow-md">
                                     <div className="flex flex-col">
                                         {/* Student Header */}
                                         <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                             <div className="flex items-center gap-4">
                                                 <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm p-1">
                                                     {group.studentImage ? (
                                                         <img src={group.studentImage} className="w-full h-full object-cover rounded-xl" alt="" />
                                                     ) : (
                                                         <div className="w-full h-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg rounded-xl">
                                                             {group.studentName.charAt(0)}
                                                         </div>
                                                     )}
                                                 </div>
                                                 <div>
                                                     <h4 className="font-black text-slate-900 leading-tight text-lg">{group.studentName}</h4>
                                                     <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{group.studentCode}</p>
                                                 </div>
                                             </div>
                                             <div className="bg-indigo-600/10 text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                                                 {group.items.length} {group.items.length === 1 ? 'Program' : 'Programs'}
                                             </div>
                                         </div>

                                         {/* Programs List */}
                                         <div className="divide-y divide-slate-50">
                                             {group.items.map((item) => {
                                                 const idx = reviewItems.findIndex(ri => ri.enrollment_id === item.enrollment_id);
                                                 return (
                                                     <div key={item.enrollment_id} className="p-8 flex flex-col md:flex-row gap-8">
                                                         {/* Program Info Side */}
                                                         <div className="md:w-2/5 space-y-4">
                                                             <div className="flex items-start gap-2.5">
                                                                 <div className="w-6 h-6 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                                                     <BookOpen size={12} />
                                                                 </div>
                                                                 <div>
                                                                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Class & Program</p>
                                                                     <p className="text-xs font-bold text-slate-600 leading-tight">{item.className}</p>
                                                                 </div>
                                                             </div>
                                                             
                                                             <div className="flex items-start gap-2.5">
                                                                 <div className="w-6 h-6 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                                                     <Calendar size={12} />
                                                                 </div>
                                                                 <div>
                                                                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Payment Term</p>
                                                                     <div className="flex items-center gap-2">
                                                                        <p className="text-xs font-bold text-slate-600 leading-tight">{item.term_name}</p>
                                                                        {item.includeNextTerm && (
                                                                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                                                + Next Term
                                                                            </span>
                                                                        )}
                                                                     </div>
                                                                 </div>
                                                             </div>

                                                             {!item.isNew && (
                                                                 <button 
                                                                     onClick={() => handleAddNextTerm(item.student_id, item.term_id || '')}
                                                                     className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                                                                 >
                                                                     <Plus size={14} />
                                                                     <span>Add Next Term</span>
                                                                 </button>
                                                             )}

                                                             {item.isNew && (
                                                                 <button 
                                                                     onClick={() => handleRemoveReviewItem(item.enrollment_id)}
                                                                     className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                                                                 >
                                                                     <X size={14} />
                                                                     <span>Remove Extention</span>
                                                                 </button>
                                                             )}
                                                         </div>

                                                         {/* Payment Side */}
                                                         <div className="flex-1 space-y-6">
                                                             <div className="grid grid-cols-2 gap-4">
                                                                 <div className="space-y-1.5">
                                                                     <div className="flex justify-between items-center ml-1">
                                                                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to Pay</label>
                                                                     </div>
                                                                     <div className="relative">
                                                                         <input 
                                                                             type="number" 
                                                                             value={item.newPaid}
                                                                             onChange={(e) => {
                                                                                 const newItems = [...reviewItems];
                                                                                 newItems[idx].newPaid = e.target.value;
                                                                                 setReviewItems(newItems);
                                                                             }}
                                                                             className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-800 text-sm font-black focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                                                                         />
                                                                     </div>
                                                                 </div>

                                                                 <div className="space-y-1.5">
                                                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                                                                     <div className="relative">
                                                                         <input 
                                                                             type="date" 
                                                                             value={item.dueDate}
                                                                             onChange={(e) => {
                                                                                 const newItems = [...reviewItems];
                                                                                 newItems[idx].dueDate = e.target.value;
                                                                                 setReviewItems(newItems);
                                                                             }}
                                                                             className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-800 text-sm font-black focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                                                                         />
                                                                     </div>
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 );
                                             })}
                                         </div>
                                     </div>
                                </div>
                            ))}
                    </div>
                </div>

                    <div className="px-10 py-8 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
                        <div className="flex-1" />
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <button 
                                onClick={() => setBulkPayModalOpen(false)}
                                className="flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-inter"
                            >
                                Back
                            </button>
                            <button 
                                onClick={performBulkPay}
                                disabled={loading}
                                className="flex-1 md:flex-none px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} className="group-hover:scale-110 transition-transform" />}
                                <span>Complete {reviewItems.length} Payments</span>
                            </button>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* Payment History Modal */}
        {historyStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                    <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                                {historyStudent.studentImage ? (
                                    <img src={historyStudent.studentImage} className="w-full h-full object-cover rounded-[1.25rem]" />
                                ) : (
                                    <span className="text-2xl font-black">{historyStudent.studentName.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{historyStudent.studentName}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{historyStudent.studentCode}</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{historyStudent.items.length} Records Total</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setHistoryStudent(null)} 
                            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:shadow-lg hover:shadow-rose-50 transition-all active:scale-95 group"
                        >
                            <span className="text-2xl group-hover:rotate-90 transition-transform">×</span>
                        </button>
                    </div>

                    <div className="p-10 max-h-[70vh] overflow-y-auto">
                        <div className="bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="py-5 px-6">Class / Term</th>
                                        <th className="py-5 px-6 text-right">Fee Details</th>
                                        <th className="py-5 px-6 text-right">Due Date</th>
                                        <th className="py-5 px-6 text-center">Status</th>
                                        <th className="py-5 px-6 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {historyStudent.items.map((item: any) => (
                                        <tr key={item.id} className="hover:bg-white transition-colors">
                                            <td className="py-5 px-6">
                                                <p className="font-black text-slate-800 text-sm tracking-tight">{item.className}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.term || 'No Term'}</p>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="flex flex-col items-end gap-0.5">
                                                     <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400">
                                                        <span>TOTAL:</span>
                                                        <span className="text-blue-700">${(item.total).toLocaleString()}</span>
                                                    </div>
                                                    {item.discount > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400">
                                                            <span>OFF:</span>
                                                            <span>-${(item.discount).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 mt-0.5">
                                                        <span>PAID:</span>
                                                        <span>${(item.paid).toLocaleString()}</span>
                                                    </div>
                                                    <div className="w-20 h-[1px] bg-slate-100 my-1" />
                                                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Balance:</span>
                                                        <span className={item.total - item.discount - item.paid > 0 ? 'text-rose-600 underline decoration-rose-200' : 'text-emerald-600'}>
                                                            ${(item.total - item.discount - item.paid).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                {item.due_date ? (
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex items-center gap-1.5 font-black text-[11px] text-slate-600">
                                                            <Calendar size={12} className="text-slate-300" />
                                                            {new Date(item.due_date).toLocaleDateString()}
                                                        </div>
                                                        {item.status === 'Unpaid' && new Date(item.due_date) < new Date() && (
                                                            <span className="text-[9px] font-black text-rose-500 uppercase mt-1">Expired</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="py-5 px-6 text-center">
                                                <span className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                    item.status === 'Paid' 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                        : 'bg-rose-50 text-rose-600 border-rose-100'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="py-5 px-6 text-center">
                                                <button 
                                                    onClick={() => setEditingPayment(item)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md transition-all active:scale-95 mx-auto"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setHistoryStudent(null)}
                                className="px-8 py-4 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
                            >
                                Close View
                            </button>
                            <button 
                                onClick={() => {
                                    alert("Printing History Report...");
                                }}
                                className="px-10 py-4 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2 active:scale-95"
                            >
                                <Download size={20} />
                                <span>Export History</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Add Inventory Item Modal */}
        {addingItemToEnrollment && (
            <AddItemModal 
                enrollment={addingItemToEnrollment}
                inventoryItems={inventoryItems}
                onClose={() => setAddingItemToEnrollment(null)}
                onSuccess={() => {
                    setAddingItemToEnrollment(null);
                }}
            />
        )}
    </div>
  );
}

function AddItemModal({ enrollment, inventoryItems, onClose, onSuccess }: { enrollment: Enrollment, inventoryItems: InventoryItem[], onClose: () => void, onSuccess: () => void }) {
    const [selectedItemId, setSelectedItemId] = useState("");
    const [selectedVariantId, setSelectedVariantId] = useState("");
    const [qty, setQty] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);
    const variants = selectedItem?.attributes?.variants || [];

    const handleAdd = async () => {
        if (!selectedItem) return;
        setIsSubmitting(true);
        try {
            const price = selectedItem.price || 0;
            const totalAdd = price * qty;

            const newAddon = {
                addonId: `manual_${Date.now()}`,
                itemId: selectedItem.id,
                nameSnapshot: selectedItem.name + (selectedVariantId ? ` (${variants.find(v => v.id === selectedVariantId)?.name})` : ""),
                priceSnapshot: price,
                qty: qty
            };

            const updatedAddons = [...(enrollment.selectedAddons || []), newAddon];
            const newTotal = Number(enrollment.total_amount) + totalAdd;

            await updateEnrollment(enrollment.enrollment_id, {
                selectedAddons: updatedAddons,
                total_amount: newTotal,
                payment_status: 'Unpaid' 
            });

            await inventoryService.decrementStock(selectedItem.id, qty, selectedVariantId);
            
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Failed to add item");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
                <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Plus size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Item</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Sell uniform or book to student</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-all"><X size={20} /></button>
                </div>

                <div className="p-10 space-y-8">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Select Item</label>
                             <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                 {inventoryItems.map(item => (
                                     <button
                                         key={item.id}
                                         onClick={() => {
                                             setSelectedItemId(item.id);
                                             setSelectedVariantId("");
                                         }}
                                         className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                                             selectedItemId === item.id 
                                             ? 'bg-indigo-50 border-indigo-500 shadow-sm' 
                                             : 'bg-white border-slate-100 hover:border-indigo-200'
                                         }`}
                                     >
                                         <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                 {item.image_url ? (
                                                     <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                 ) : (
                                                     <BookOpen size={16} className="text-slate-300" />
                                                 )}
                                             </div>
                                             <div className="text-left">
                                                 <p className="font-bold text-sm text-slate-800 leading-tight">{item.name}</p>
                                                 <p className="text-[10px] font-bold text-slate-400 mt-0.5">{item.category}</p>
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-3">
                                             <span className="font-black text-sm text-indigo-600">${item.price}</span>
                                             <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                 selectedItemId === item.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                                             }`}>
                                                 {selectedItemId === item.id && <Check size={12} className="text-white" strokeWidth={3} />}
                                             </div>
                                         </div>
                                     </button>
                                 ))}
                             </div>
                        </div>

                        {variants.length > 0 && (
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Style / Size</label>
                                <div className="flex flex-wrap gap-2">
                                    {variants.map(v => (
                                        <button 
                                            key={v.id}
                                            onClick={() => setSelectedVariantId(v.id)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${selectedVariantId === v.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                                        >
                                            {v.name} ({v.stock} in stock)
                                        </button>
                                    ))}
                                </div>
                             </div>
                        )}

                        <div className="space-y-2 w-32">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                            <input 
                                type="number" 
                                min="1"
                                value={qty}
                                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent text-slate-900 font-bold text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAdd}
                            disabled={!selectedItemId || (variants.length > 0 && !selectedVariantId) || isSubmitting}
                            className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                            <span>Add and Update Balance</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

 function PaymentGroupRow({ group, isSelected, onSelect, onViewHistory, onEdit, onAddItem }: { group: any, isSelected: boolean, onSelect: (s: boolean) => void, onViewHistory: any, onEdit: any, onAddItem: any }) {
    const { profile } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        }
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    // Derived Group Status
    const netTotal = group.totalFee - group.totalDiscount;
    const isActuallyPaid = group.totalPaid >= netTotal;
    const hasExpired = group.items.some((item: any) => item.status === 'Unpaid' && item.due_date && new Date(item.due_date) < new Date());
    const isFullyPaid = isActuallyPaid && !hasExpired;
    const balanceDue = netTotal - group.totalPaid;

    return (
         <tr 
            className={`group hover:bg-slate-50 transition-all border-l-4 ${isSelected ? 'border-l-indigo-500 bg-indigo-50/30' : 'border-l-transparent'}`}
        >
            <td className="py-4 px-6">
                <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={isSelected}
                    onChange={(e) => onSelect(e.target.checked)}
                />
            </td>
            <td className="py-4 px-6 print:hidden">
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        title="Actions"
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-sm transition-all active:scale-95 mx-auto lg:mx-0"
                    >
                        <MoreVertical size={18} />
                    </button>

                    {showMenu && (
                        <div className="absolute left-12 top-0 flex items-center p-1.5 gap-1 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onViewHistory();
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="View History"
                            >
                                <Eye size={18} />
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onAddItem();
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                title="Add Item"
                            >
                                <Plus size={18} />
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onEdit();
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                title="Edit Payment"
                            >
                                <Pencil size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </td>
                <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden border border-slate-200">
                            {group.studentImage ? <img src={group.studentImage} className="w-full h-full object-cover" /> : group.studentName.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 text-sm">{group.studentName}</p>
                            <p className="text-[10px] text-slate-400 font-bold tracking-tight">{group.items.length} Enrollment{group.items.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </td>
                <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(group.items.map((item: any) => item.className))).map((className: any, i: number) => (
                            <span key={i} className="text-[9px] font-black text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                {className}
                            </span>
                        ))}
                    </div>
                </td>
                <td className="py-4 px-6 text-right">
                    <div className="space-y-0.5">
                        <p className={`text-xs font-black ${isFullyPaid ? 'text-emerald-600' : 'text-slate-900 font-black'}`}>
                            {isFullyPaid ? 'PAID' : `$${balanceDue.toLocaleString()}`}
                        </p>
                        {!isFullyPaid && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">of ${(group.totalFee - group.totalDiscount).toLocaleString()}</p>}
                    </div>
                </td>
                 <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {(() => {
                            const date = group.earliestDueDate || group.items[0]?.due_date;
                            if (!date) return <span className="text-slate-300 font-bold text-[10px]">N/A</span>;
                            
                            const isOverdue = !isFullyPaid && new Date(date) < new Date();
                            
                            return (
                                <div className={`flex flex-col items-end ${isOverdue ? 'text-rose-600' : 'text-slate-600'}`}>
                                    <div className="flex items-center gap-1.5 font-black text-[11px]">
                                        <Calendar size={12} className={isOverdue ? 'text-rose-500' : 'text-indigo-400'} />
                                        {new Date(date).toLocaleDateString()}
                                    </div>
                                    {isOverdue && (
                                        <span className="text-[9px] font-black uppercase tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded mt-0.5 border border-rose-100 animate-pulse">
                                            Overdue
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </td>
                <td className="py-4 px-6 text-center">
                    <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        isFullyPaid 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                        {isFullyPaid ? 'Paid' : 'Unpaid'}
                    </span>
                </td>
            </tr>
    );
}
