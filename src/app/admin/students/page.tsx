"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
    UserPlus, Search, Filter, Loader2, Pencil, Trash2, Eye, 
    ArrowUpDown, ArrowUp, ArrowDown, Settings2, X, ChevronDown,
    Users, Calendar, CreditCard, Shield, Check, MoreVertical, Download
} from "lucide-react";
import { Student, Branch, Enrollment, Class } from "@/lib/types";
import { 
    subscribeToStudents, 
    deleteStudent, 
    subscribeToEnrollments,
    subscribeToClasses 
} from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { AddInsuranceModal } from "@/components/modals/AddInsuranceModal";
import ImportStudentModal from "@/components/modals/ImportStudentModal";
import * as XLSX from "xlsx";

// Column definition
const ALL_COLUMNS = [
    { key: 'action', label: 'Action', sortable: false },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'gender', label: 'Gender', sortable: true },
    { key: 'nationality', label: 'Nationality', sortable: true },
    { key: 'dob', label: 'DOB', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'branch', label: 'Branch', sortable: true },
    { key: 'program', label: 'Program', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'admission_date', label: 'Admission Date', sortable: true },
    // Hidden by default
    { key: 'insurance_number', label: 'Insurance ID', sortable: false },
    { key: 'insurance_expired', label: 'Insurance Expiry', sortable: true },
    { key: 'created_by', label: 'Created by', sortable: true },
    { key: 'modified_by', label: 'Modified by', sortable: true },
    { key: 'created_at', label: 'Created at', sortable: true },
    { key: 'updated_at', label: 'Updated at', sortable: true },
    { key: 'payment_status', label: 'Payment Status', sortable: true },
    { key: 'payment_expired', label: 'Payment End Date', sortable: true },
    { key: 'payment_note', label: 'Payment Note', sortable: false },
];

export default function StudentsPage() {
    const router = useRouter();

    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [programs, setPrograms] = useState<any[]>([]); // any[] to handle potential type discrepancies
    const [loading, setLoading] = useState(true);

    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [filterBranch, setFilterBranch] = useState("");
    const [filterStatus, setFilterStatus] = useState(""); // Active, Inactive
    const [filterPaymentStatus, setFilterPaymentStatus] = useState("");

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState<string[]>([
        'action', 'name', 'gender', 'nationality', 'dob', 'phone', 'branch', 'program', 'status', 'admission_date'
    ]);
    
    // UI State
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showSortPanel, setShowSortPanel] = useState(false);
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Action Menu State
    const [activeActionId, setActiveActionId] = useState<string | null>(null);

    // Modals State
    const [showInsuranceModal, setShowInsuranceModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState("");

    // Selection State
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

    // Fetch Data
    useEffect(() => {
        const unsubStudents = subscribeToStudents((data) => {
            setStudents(data);
            setLoading(false);
        });
        const unsubBranches = branchService.subscribe(setBranches);
        const unsubEnrollments = subscribeToEnrollments(setEnrollments);
        const unsubClasses = subscribeToClasses(setClasses);
        const unsubPrograms = programService.subscribe(setPrograms);

        return () => {
            unsubStudents();
            unsubBranches();
            unsubEnrollments();
            unsubClasses();
            unsubPrograms();
        };
    }, []);

    // Helper Functions
    const calculateAge = (dob: string) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getBranchName = (branchId: string) => {
        return branches.find(b => b.branch_id === branchId)?.branch_name || "N/A";
    };

    const getLatestEnrollment = (studentId: string) => {
        const studentEnrollments = enrollments.filter(e => e.student_id === studentId);
        if (studentEnrollments.length === 0) return null;
        return studentEnrollments.sort((a, b) => 
            new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime()
        )[0];
    };

    const isInsuranceExpired = (student: Student) => {
        if (!student.insurance_info?.end_date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(student.insurance_info.end_date);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today;
    };

    // Enhanced student data with computed fields
    const enhancedStudents = useMemo(() => {
        return students.map(student => {
            const latestEnrollment = getLatestEnrollment(student.student_id);
            const insuranceExpired = isInsuranceExpired(student);
            
            // Resolve Program Name
            let programName = "N/A";
            const studentEnrollments = enrollments.filter(e => e.student_id === student.student_id);
            
            if (studentEnrollments.length > 0) {
                const programNames = studentEnrollments.map(enr => {
                    const cls = classes.find(c => c.class_id === enr.class_id);
                    if (cls) {
                         const program = programs.find((p: any) => p.id === cls.programId);
                         return program ? (program.program_name || program.name) : null;
                    }
                    return null;
                }).filter(Boolean); // Remove nulls

                if (programNames.length > 0) {
                    // Deduplicate and join
                    programName = Array.from(new Set(programNames)).join(", ");
                }
            }
            
            return {
                ...student,
                age: calculateAge(student.dob),
                branch_name: getBranchName(student.branch_id),
                program: programName, 
                payment_status: latestEnrollment?.payment_status || "N/A",
                payment_expired: latestEnrollment?.payment_expired || "N/A",
                payment_note: "N/A",
                insurance_number: student.insurance_info?.policy_number || "N/A",
                insurance_expired: student.insurance_info?.end_date || "N/A",
                insurance_status: !student.insurance_info ? "none" : insuranceExpired ? "expired" : "active",
                created_at: student.created_at || "N/A",
                updated_at: student.modified_at || "N/A",
            };
        });
    }, [students, branches, enrollments, classes, programs]);

    // Filtered and Sorted Data
    const filteredAndSortedStudents = useMemo(() => {
        let filtered = enhancedStudents;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                s.student_name.toLowerCase().includes(query) ||
                s.student_code.toLowerCase().includes(query) ||
                s.phone.toLowerCase().includes(query)
            );
        }

        // Branch filter
        if (filterBranch) {
            filtered = filtered.filter(s => s.branch_id === filterBranch);
        }

        // Status filter
        if (filterStatus) {
            filtered = filtered.filter(s => s.status === filterStatus);
        }

        // Payment Status filter
        if (filterPaymentStatus) {
            filtered = filtered.filter(s => s.payment_status === filterPaymentStatus);
        }

        // Insurance Status filter (Generic check if used)

        // Sorting
        if (sortConfig) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof typeof a];
                const bVal = b[sortConfig.key as keyof typeof b];
                
                if (aVal === null || aVal === undefined || aVal === "N/A") return 1;
                if (bVal === null || bVal === undefined || bVal === "N/A") return -1;
                
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [enhancedStudents, searchQuery, filterBranch, filterStatus, filterPaymentStatus, sortConfig]);

    // Sorting Handler
    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (!prev || prev.key !== key) {
                return { key, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            return null;
        });
    };

    // Column Visibility Toggle
    const toggleColumn = (columnKey: string) => {
        setVisibleColumns(prev => 
            prev.includes(columnKey)
                ? prev.filter(k => k !== columnKey)
                : [...prev, columnKey]
        );
    };

    const handleDelete = async (studentId: string) => {
        if (!confirm("Are you sure you want to delete this student?")) return;
        try {
            await deleteStudent(studentId);
        } catch (error) {
            console.error(error);
            alert("Failed to delete student");
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedStudents.size} students? This action cannot be undone.`)) return;
        
        try {
            setLoading(true);
            await Promise.all(
                Array.from(selectedStudents).map(id => deleteStudent(id))
            );
            setSelectedStudents(new Set());
            // Data subscription will auto-update the list
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert("Failed to delete some students");
        } finally {
            setLoading(false);
        }
    };

    // Selection Handlers
    const handleSelectAll = () => {
        if (selectedStudents.size === filteredAndSortedStudents.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(filteredAndSortedStudents.map(s => s.student_id)));
        }
    };

    const handleSelectStudent = (id: string) => {
        const newSelected = new Set(selectedStudents);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedStudents(newSelected);
    };

    const handleExport = () => {
        if (filteredAndSortedStudents.length === 0) return;

        // 1. Prepare Header Rows (Pretty Template)
        const headerRows = [
            ["Authentic Advanced Academy (AAA)"],
            ["Student List Report"],
            [`Export Date: ${new Date().toLocaleDateString()}`],
            [`Total Students: ${filteredAndSortedStudents.length}`],
            [], // Spacer
            ['Student ID', 'Name', 'Gender', 'DOB', 'Nationality', 'Branch', 'Program', 'Status', 'Admission Date', 'Payment Status']
        ];

        // 2. Prepare Data Rows
        const dataRows = filteredAndSortedStudents.map(s => [
            s.student_code,
            s.student_name,
            s.gender,
            s.dob,
            s.nationality,
            s.branch_name,
            s.program,
            s.status,
            s.admission_date,
            s.payment_status
        ]);

        // 3. Combine and Create Sheet
        const allRows = [...headerRows, ...dataRows];
        const worksheet = XLSX.utils.aoa_to_sheet(allRows);

        // 4. Set Column Widths
        const wscols = [
            { wch: 15 }, // Student ID
            { wch: 30 }, // Name
            { wch: 10 }, // Gender
            { wch: 15 }, // DOB
            { wch: 15 }, // Nationality
            { wch: 20 }, // Branch
            { wch: 25 }, // Program
            { wch: 12 }, // Status
            { wch: 15 }, // Admission Date
            { wch: 15 }, // Payment Status
        ];
        worksheet['!cols'] = wscols;

        // 5. Create Workbook and Write
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
        
        // Use XLSX.writeFile for browser download
        XLSX.writeFile(workbook, `Students_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1800px] mx-auto space-y-10 pb-20 font-sans">
            
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-white/50 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                        <Users size={20} className="sm:hidden" />
                        <Users size={32} className="hidden sm:block" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
                            Students 
                            <span className="text-[10px] sm:text-xs font-black bg-indigo-50 text-indigo-600 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-indigo-100/50">
                                {filteredAndSortedStudents.length} TOTAL
                            </span>
                        </h1>
                        <p className="text-[11px] sm:text-sm font-medium text-slate-500 mt-0.5 sm:mt-1">Manage student directory and academic records</p>
                    </div>
                 </div>

                 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={handleExport}
                        className="p-3 sm:p-3.5 bg-white text-slate-500 rounded-[1.25rem] hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all border border-slate-100 shadow-sm hover:shadow-lg active:scale-95 group"
                        title="Export Report"
                    >
                        <Download size={18} className="sm:hidden" />
                        <Download size={20} className="hidden sm:block transition-transform group-hover:scale-110" />
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-3.5 bg-white text-slate-700 rounded-[1.25rem] font-black text-xs sm:text-sm hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all border border-slate-100 shadow-sm hover:shadow-lg active:scale-95 group"
                    >
                        <Download size={18} className="rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors sm:hidden" />
                        <Download size={20} className="rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors hidden sm:block" />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={() => router.push('/admin/students/add')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 bg-indigo-600 text-white rounded-[1.25rem] font-black text-xs sm:text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5 active:scale-95"
                    >
                        <UserPlus size={18} className="sm:hidden" />
                        <UserPlus size={20} className="hidden sm:block" />
                        <span>Add New Student</span>
                    </button>
                 </div>
            </div>

            {/* Toolbar Area */}
            <div className="bg-white/60 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-white/50 shadow-sm transition-all duration-300 relative z-30">
                    {/* Left: Search Bar & View Controls */}
                    <div className="flex flex-wrap items-center gap-3 w-full">
                        <div className="relative w-full md:max-w-[300px] group">
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-6 pr-12 py-3.5 sm:pl-8 sm:pr-14 sm:py-4 bg-white border border-slate-200 rounded-[1.25rem] text-xs sm:text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-5 sm:right-6 flex items-center pointer-events-none">
                                <Search size={22} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            </div>
                        </div>

                        <div className="relative flex-1 sm:flex-initial">
                            <button 
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-[1.25rem] font-black text-xs uppercase tracking-widest transition-all border ${
                                    showFilterPanel || filterBranch || filterStatus || filterPaymentStatus
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-100'
                                    : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                                }`}
                            >
                                <Filter size={18} />
                                <span>Filters</span>
                                {(filterBranch || filterStatus || filterPaymentStatus) && (
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ring-2 ring-white ${
                                        showFilterPanel || filterBranch || filterStatus || filterPaymentStatus ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                                    }`}>
                                        {(filterBranch ? 1 : 0) + (filterStatus ? 1 : 0) + (filterPaymentStatus ? 1 : 0)}
                                    </span>
                                )}
                            </button>

                            {/* Filter Popup */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowFilterPanel(false)} />
                                    <div className="absolute top-full left-0 mt-4 w-72 bg-white border border-slate-100 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                        <div className="max-h-[450px] overflow-y-auto custom-scrollbar p-2">
                                            {/* Status Section */}
                                            <div className="mb-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Status</h4>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {['Active', 'Inactive', 'Hold'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
                                                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm font-bold ${
                                                                filterStatus === status ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                            }`}
                                                        >
                                                            <span>{status}</span>
                                                            {filterStatus === status && <Check size={16} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100/50 my-4 mx-2" />

                                            {/* Branch Section */}
                                            <div className="mb-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Branch</h4>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {branches.map(b => (
                                                        <button
                                                            key={b.branch_id}
                                                            onClick={() => setFilterBranch(filterBranch === b.branch_id ? "" : b.branch_id)}
                                                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm font-bold ${
                                                                filterBranch === b.branch_id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                            }`}
                                                        >
                                                            <span className="truncate">{b.branch_name}</span>
                                                            {filterBranch === b.branch_id && <Check size={16} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100/50 my-4 mx-2" />

                                            {/* Payment Section */}
                                            <div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Payment</h4>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {['Paid', 'Unpaid'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setFilterPaymentStatus(filterPaymentStatus === status ? "" : status)}
                                                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm font-bold ${
                                                                filterPaymentStatus === status ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                            }`}
                                                        >
                                                            <span>{status}</span>
                                                            {filterPaymentStatus === status && <Check size={16} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative flex-1 sm:flex-initial">
                            <button 
                                onClick={() => setShowColumnPanel(!showColumnPanel)}
                                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-500 rounded-[1.25rem] font-black text-xs uppercase tracking-widest transition-all border border-slate-100 hover:bg-slate-50 shadow-sm"
                            >
                                <Settings2 size={18} />
                                <span>Columns</span>
                            </button>

                            {/* Column Popup */}
                            {showColumnPanel && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColumnPanel(false)} />
                                    <div className="absolute top-full left-0 mt-4 w-72 bg-white border border-slate-100 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                         <div className="max-h-[450px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Display Columns</h4>
                                            {ALL_COLUMNS.map(col => (
                                                <button
                                                    key={col.key}
                                                    onClick={() => toggleColumn(col.key)}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm font-bold ${
                                                        visibleColumns.includes(col.key) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-500'
                                                    }`}
                                                >
                                                    <span>{col.label}</span>
                                                    {visibleColumns.includes(col.key) && <Check size={16} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                             )}
                        </div>
                    </div>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[1.25rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-all duration-300">
                <div className="overflow-x-auto min-h-[400px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 transition-colors">
                                <th className="px-6 py-4 w-12">
                                    <div className="flex items-center justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={filteredAndSortedStudents.length > 0 && selectedStudents.size === filteredAndSortedStudents.length}
                                            onChange={handleSelectAll}
                                        />
                                    </div>
                                </th>
                                {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map((col, index) => (
                                    <th
                                        key={col.key}
                                        className={`text-left px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ${
                                            col.sortable ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''
                                        } ${col.key === 'name' ? 'min-w-[280px]' : ''} ${col.key === 'dob' ? 'min-w-[140px]' : ''}`}
                                        onClick={() => col.sortable && handleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{col.label}</span>
                                            {col.sortable && (
                                                <span className="text-slate-300">
                                                    {sortConfig?.key === col.key ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-indigo-500" /> : <ArrowDown size={12} className="text-indigo-500" />
                                                    ) : (
                                                        <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredAndSortedStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 1} className="p-16 text-center text-slate-400 text-sm font-medium">
                                            No students found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedStudents.map(student => (
                                        <tr key={student.student_id} className={`hover:bg-slate-50/80 transition-colors group ${selectedStudents.has(student.student_id) ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedStudents.has(student.student_id)}
                                                        onChange={() => handleSelectStudent(student.student_id)}
                                                    />
                                                </div>
                                            </td>
                                        {visibleColumns.includes('action') && (
                                            <td className="p-4 pl-6">
                                                <div className="relative z-10">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveActionId(activeActionId === student.student_id ? null : student.student_id);
                                                        }}
                                                        className="p-2 rounded-[1.25rem] hover:bg-white hover:shadow-md text-slate-400 hover:text-indigo-600 transition-all"
                                                    >
                                                        <MoreVertical size={18} />
                                                    </button>
                                                    
                                                    {activeActionId === student.student_id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={() => setActiveActionId(null)}
                                                            />
                                                            <div className="absolute left-0 bottom-full mb-2 flex items-center gap-1 bg-white rounded-[1.25rem] shadow-xl border border-slate-100 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                                <button
                                                                    onClick={() => router.push(`/admin/students/${student.student_id}`)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                                    title="View Details"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => router.push(`/admin/students/edit/${student.student_id}`)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                                                    title="Edit Profile"
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedStudentId(student.student_id);
                                                                        setShowInsuranceModal(true);
                                                                        setActiveActionId(null);
                                                                    }}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                                                    title="Insurance"
                                                                >
                                                                    <Shield size={16} />
                                                                </button>
                                                                <div className="w-px h-6 bg-slate-100 mx-1"/>
                                                                <button
                                                                    onClick={() => {
                                                                        handleDelete(student.student_id);
                                                                        setActiveActionId(null);
                                                                    }}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.includes('name') && (
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden border-2 border-white shadow-sm">
                                                        {student.image_url ? (
                                                            <img src={student.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            student.student_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{student.student_name}</p>
                                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{student.student_code}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.includes('gender') && (
                                            <td className="p-4">
                                                <span className="font-bold text-slate-600 text-sm">{student.gender}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('nationality') && (
                                            <td className="p-4">
                                                <span className="font-bold text-slate-600 text-sm">{student.nationality}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('dob') && (
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-600 text-sm">{student.dob}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('phone') && (
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-500 text-sm">{student.phone}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('branch') && (
                                            <td className="p-4">
                                                <span className="inline-flex px-3 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                                                    {student.branch_name}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('program') && (
                                            <td className="p-4">
                                                <span className="text-sm font-medium text-slate-500">{student.program}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('status') && (
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        student.status === 'Active' ? 'bg-emerald-500' :
                                                        student.status === 'Hold' ? 'bg-amber-500' :
                                                        'bg-slate-300'
                                                    }`} />
                                                    <span className={`text-xs font-bold ${
                                                        student.status === 'Active' ? 'text-emerald-700' :
                                                        student.status === 'Hold' ? 'text-amber-700' :
                                                        'text-slate-500'
                                                    }`}>
                                                        {student.status}
                                                    </span>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.includes('admission_date') && (
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-600 text-sm">{student.admission_date}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('payment_status') && (
                                            <td className="p-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                                                    student.payment_status === 'Paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                    student.payment_status === 'Unpaid' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                                    'bg-slate-50 border-slate-100 text-slate-500'
                                                }`}>
                                                    {student.payment_status}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('payment_expired') && (
                                            <td className="p-4">
                                                <span className="font-semibold text-slate-600 text-sm">
                                                    {student.payment_expired !== 'N/A' 
                                                        ? new Date(student.payment_expired).toLocaleDateString()
                                                        : 'N/A'
                                                    }
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('insurance_number') && (
                                            <td className="p-4">
                                                <span className="font-mono text-slate-500 text-xs font-bold">{student.insurance_number}</span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('insurance_expired') && (
                                            <td className="p-4">
                                                <span className={`font-bold text-xs uppercase tracking-wider ${
                                                    student.insurance_status === 'expired' ? 'text-rose-600' :
                                                    student.insurance_status === 'active' ? 'text-emerald-600' :
                                                    'text-slate-300'
                                                }`}>
                                                    {student.insurance_expired !== 'N/A'
                                                        ? new Date(student.insurance_expired).toLocaleDateString()
                                                        : 'N/A'
                                                    }
                                                </span>
                                            </td>
                                        )}
                                        {/* Fallback for other columns */}
                                        {['created_by', 'modified_by', 'created_at', 'updated_at', 'payment_note'].map(colKey => {
                                            if (visibleColumns.includes(colKey)) {
                                                const val = (student as any)[colKey] || 'N/A';
                                                return (
                                                    <td key={colKey} className="p-4">
                                                        <span className="text-slate-500 text-xs font-medium">{val}</span>
                                                    </td>
                                                )
                                            }
                                            return null;
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS */}
            {showInsuranceModal && (
                <AddInsuranceModal
                    isOpen={showInsuranceModal}
                    onClose={() => setShowInsuranceModal(false)}
                    studentId={selectedStudentId}
                    onSuccess={() => setShowInsuranceModal(false)}
                />
            )}

            {showImportModal && (
                <ImportStudentModal 
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => {
                        // Success handling - list will auto-refresh via subscription
                    }}
                />
            )}
            {/* Floating Selection Bar */}
            {selectedStudents.size > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="bg-slate-900 text-white px-8 py-5 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 backdrop-blur-xl border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-black">
                                {selectedStudents.size}
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-slate-400">Selected</span>
                        </div>
                        
                        <div className="w-px h-8 bg-white/10" />
                        
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-6 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                            >
                                <Trash2 size={16} />
                                <span>Delete</span>
                            </button>
                            <button 
                                onClick={() => setSelectedStudents(new Set())}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white/5 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
                            >
                                <X size={16} />
                                <span>Cancel</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
