"use client";

import { useEffect, useState, useMemo } from "react";
import { subscribeToStudents, subscribeToClasses, subscribeToEnrollments, updateEnrollment, deleteEnrollment } from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { Student, Class, Enrollment, Branch } from "@/lib/types";
import { Search, Loader2, Calendar, FileText, Download, Trash2, Filter, CheckCircle, ArrowLeft, ChevronDown, ChevronUp, AlertCircle, Users, DollarSign, Eye } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState<string>('Active');
  
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [bulkPayDate, setBulkPayDate] = useState("");

  // History Modal
  const [historyStudent, setHistoryStudent] = useState<any | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      if (!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) return;
      try {
          await deleteEnrollment(id);
      } catch (err) {
          console.error(err);
          alert("Failed to delete record");
      }
  }

  async function performBulkPay() {
      if (!selectedClassId || selectedClassId === 'all') return;
      
      const studentsInClass = enrollments.filter(e => e.class_id === selectedClassId);
      let count = 0;
      
      for (const enr of studentsInClass) {
          const needed = Number(enr.total_amount) - Number(enr.discount || 0);
          if (Number(enr.paid_amount) < needed) {
             await updateEnrollment(enr.enrollment_id, {
                 paid_amount: needed,
                 payment_status: 'Paid',
                 ...(bulkPayDate ? { payment_due_date: bulkPayDate } : {})
             });
             count++;
          }
      }
      alert(`Updated ${count} records to Paid.`);
      setBulkPayModalOpen(false);
  }

  function openBulkPayModal(classId: string) {
      if (classId === 'all') return;
      // Default to 1 year from now? or just empty
      setBulkPayDate(""); 
      setBulkPayModalOpen(true);
  }

  useEffect(() => {
    const unsubStudents = subscribeToStudents(setStudents);
    const unsubClasses = subscribeToClasses(setClasses);
    const unsubBranches = branchService.subscribe(setBranches);
    const unsubPrograms = programService.subscribe(setPrograms);
    const unsubEnrollments = subscribeToEnrollments((data) => {
        setEnrollments(data);
        setLoading(false);
    });

    return () => { 
        unsubStudents(); 
        unsubClasses(); 
        unsubBranches();
        unsubPrograms();
        unsubEnrollments(); 
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearch(searchQuery);
        setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

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
          const matchesProgram = selectedProgramId === 'all' || enr.programId === selectedProgramId;
          
          // Class filter: if 'all', use filteredClasses, otherwise use specific classId
          const matchesClass = selectedClassId === 'all' 
              ? filteredClasses.map(c => c.class_id).includes(enr.class_id)
              : enr.class_id === selectedClassId;
          
          // Handle enrollment status filter (default to 'Active')
          const enrStatus = enr.enrollment_status || 'Active';
          const matchesStatus = selectedEnrollmentStatus === 'all' || enrStatus === selectedEnrollmentStatus;

          return matchesSearch && matchesBranch && matchesProgram && matchesClass && matchesStatus;
      });

      return filtered.map(enr => {
          const student = students.find(s => s.student_id === enr.student_id);
          const cls = classes.find(c => c.class_id === enr.class_id);
          
          const total = Number(enr.total_amount) - Number(enr.discount || 0);
          const isPaidAmount = Number(enr.paid_amount) >= total;
          const dueDate = enr.payment_due_date || enr.payment_expired; // Fallback for legacy data
          
          let status = 'Unpaid';
          if (isPaidAmount) status = 'Paid';
          
          if (enr.enrollment_status && enr.enrollment_status !== 'Active') {
              status = enr.enrollment_status; 
          } 

          return {
              id: enr.enrollment_id,
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
  }, [enrollments, students, classes, searchQuery, selectedBranchId, selectedProgramId, selectedClassId, selectedEnrollmentStatus, filteredClasses]);

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

            // Smart Due Date: Find the earliest due date that is unpaid
            if (row.status === 'Unpaid' && row.due_date) {
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

  if (loading) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  return (
    <div className="max-w-[1800px] mx-auto space-y-4 sm:space-y-6 pb-20 px-4 xl:px-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-2">
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
            
            <div className="flex items-center gap-3 sm:gap-4 bg-white/50 backdrop-blur-md p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/50">
                 <div className="px-3 py-1 sm:px-4 sm:py-2 text-right border-r border-slate-100">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Collected</p>
                    <p className="text-base sm:text-xl font-black text-emerald-600 tracking-tight">${summaryStats.totalCollected.toLocaleString()}</p>
                </div>
                <button 
                    onClick={handlePrint}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-100 transition-all active:scale-95 group shadow-lg"
                >
                    <Download size={14} className="sm:hidden" />
                    <Download size={16} className="hidden sm:block group-hover:-translate-y-0.5 transition-transform" />
                    <span>Report</span>
                </button>
            </div>
        </div>

        {/* Matching Image Style: Minimalist Search & Filter Bar */}
        <div className="bg-slate-50/80 backdrop-blur-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 flex flex-wrap items-center gap-3 sm:gap-4 mb-2">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px] md:max-w-[300px] group">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-5 pr-12 py-3 rounded-[1.25rem] bg-white border border-slate-100 text-slate-600 font-bold text-xs sm:text-sm placeholder:text-slate-400 outline-none transition-all shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5"
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Search className="text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                </div>
            </div>

            {/* Branch Filter */}
            <div className="relative w-full sm:w-auto sm:min-w-[160px]">
                <select 
                    value={selectedBranchId}
                    onChange={(e) => {
                        setSelectedBranchId(e.target.value);
                        setSelectedProgramId('all');
                        setSelectedClassId('all');
                    }}
                    className="w-full pl-5 pr-10 py-2.5 sm:pl-6 sm:pr-12 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white border border-slate-100 text-slate-600 font-bold text-xs sm:text-sm outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                    <option value="all">All Branches</option>
                    {branches.map(b => (
                        <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:hidden" size={16} />
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden sm:block" size={18} />
            </div>

            {/* Program Filter */}
            <div className="relative w-full sm:w-auto sm:min-w-[160px]">
                <select 
                    value={selectedProgramId}
                    onChange={(e) => {
                        setSelectedProgramId(e.target.value);
                        setSelectedClassId('all');
                    }}
                    className="w-full pl-5 pr-10 py-2.5 sm:pl-6 sm:pr-12 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white border border-slate-100 text-slate-600 font-bold text-xs sm:text-sm outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                    <option value="all">All Programs</option>
                    {programs
                        .filter(p => selectedBranchId === 'all' || p.branchId === selectedBranchId)
                        .map(p => (
                        <option key={p.program_id || p.id} value={p.program_id || p.id}>{p.program_name || p.name}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:hidden" size={16} />
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden sm:block" size={18} />
            </div>

            {/* Class Filter */}
            <div className="relative w-full sm:w-auto sm:min-w-[160px]">
                <select 
                     value={selectedClassId}
                     onChange={(e) => setSelectedClassId(e.target.value)}
                     className="w-full pl-5 pr-10 py-2.5 sm:pl-6 sm:pr-12 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white border border-slate-100 text-slate-600 font-bold text-xs sm:text-sm outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                    <option value="all">All Classes</option>
                    {filteredClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.className}</option>)}
                </select>
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:hidden" size={16} />
                <ChevronDown className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden sm:block" size={18} />
            </div>

            {/* Enrollment Status Filter Toggle */}
            <button
                onClick={() => setSelectedEnrollmentStatus(selectedEnrollmentStatus === 'Active' ? 'all' : 'Active')}
                className={`w-full sm:w-auto sm:ml-auto px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all ${selectedEnrollmentStatus === 'Active' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border-slate-100 hover:text-slate-600'}`}
            >
                {selectedEnrollmentStatus === 'Active' ? 'Active Only' : 'All Status'}
            </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
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
                                <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">No payments found.</td>
                            </tr>
                        ) : (
                            paginatedGroups.map((group, idx) => (
                                <PaymentGroupRow 
                                    key={idx} 
                                    group={group} 
                                    onViewHistory={() => setHistoryStudent(group)}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Showing page {currentPage} of {totalPages}
                    </p>
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
        {/* Bulk Pay Modal */}
        {bulkPayModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Mark Class as Paid</h2>
                        <button onClick={() => setBulkPayModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="text-xl">×</span></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Payment Expiry Date (Optional)</label>
                            <input 
                                type="date" 
                                value={bulkPayDate}
                                onChange={(e) => setBulkPayDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                            />
                            <p className="text-xs text-slate-400 font-medium ml-1">Leave empty to keep existing dates or set to none.</p>
                        </div>
                        <button 
                            onClick={performBulkPay}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                        >
                            Confirm Payment
                        </button>
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
    </div>
  );
}

function PaymentGroupRow({ group, onViewHistory }: { group: any, onViewHistory: any }) {
    // Derived Group Status
    const netTotal = group.totalFee - group.totalDiscount;
    const isFullyPaid = group.totalPaid >= netTotal;
    const balanceDue = netTotal - group.totalPaid;

    return (
        <tr 
            className="group hover:bg-slate-50 transition-all border-l-4 border-l-transparent"
        >
            <td className="py-4 px-6 print:hidden">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewHistory();
                    }}
                    title="View Student Payment History"
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50 transition-all active:scale-95"
                >
                   <Eye size={18} />
                </button>
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
                        {isFullyPaid ? 'Fully Paid' : 'Unpaid'}
                    </span>
                </td>
            </tr>
    );
}
