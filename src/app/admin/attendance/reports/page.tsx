"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, Filter, Download, Calendar, Users, TrendingUp, TrendingDown, ChevronDown, CheckCircle2 } from "lucide-react";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { 
    subscribeToClasses, 
    subscribeToStudents, 
    subscribeToEnrollmentsByClass,
    subscribeToAttendance 
} from "@/lib/services/schoolService";
import { Student, Enrollment, Attendance } from "@/lib/types";


interface StudentReport {
    student: Student;
    enrollment: Enrollment;
    className: string; // Added className
    totalSessions: number;
    presents: number;
    absents: number;
    leaves: number;
    attendanceRate: number;
    notes?: string;
}

export default function AttendanceReportsPage() {
    const [branches, setBranches] = useState<any[]>([]);
    const [terms, setTerms] = useState<any[]>([]); // Added terms state
    const [programs, setPrograms] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
    
    const [filterBranch, setFilterBranch] = useState("");
    const [filterTerm, setFilterTerm] = useState(""); // Added term filter
    const [filterProgram, setFilterProgram] = useState("");
    const [filterClass, setFilterClass] = useState("");

    const handleExport = async () => {
        if (reportData.length === 0) return;

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        // 1. Resolve metadata for header
        const branchName = branches.find((b: any) => b.branch_id === filterBranch)?.branch_name || "All Branches";
        const termName = terms.find((t: any) => t.term_id === filterTerm)?.term_name || "All Terms";
        const programName = programs.find((p: any) => p.id === filterProgram)?.name || "All Programs";
        const className = classes.find((c: any) => c.class_id === filterClass)?.className || "All Classes";
        const TOTAL_COLS = 9;

        // 2. School Branding Row
        const titleRow = worksheet.addRow(['Authentic Advanced Academy (AAA)']);
        worksheet.mergeCells(`A1:I1`);
        titleRow.getCell(1).font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF4F46E5' } };
        titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        titleRow.height = 40;

        // 3. Sub-title
        const subRow = worksheet.addRow(['Attendance Analytics Report']);
        worksheet.mergeCells('A2:I2');
        subRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF64748B' } };
        subRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        subRow.height = 26;

        // 4. Meta info
        const metaRow = worksheet.addRow([`Export Date: ${new Date().toLocaleDateString()}  •  Term: ${termName}  •  Branch: ${branchName}  •  Program: ${programName}  •  Class: ${className}`]);
        worksheet.mergeCells('A3:I3');
        metaRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
        metaRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        metaRow.height = 20;

        // 5. Spacer
        worksheet.addRow([]);

        // 6. Column Headers
        const headers = ['Student Name', 'Code', 'Class', 'Present', 'Absent', 'Leave', 'Total Sessions', 'Attendance Rate', 'Notes'];
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 32;
        headerRow.eachCell((cell, colNum) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: colNum === 1 || colNum === 3 || colNum === TOTAL_COLS ? 'left' : 'center', vertical: 'middle' };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FF4338CA' } } };
        });

        // 7. Data Rows
        reportData.forEach((r: any, index: number) => {
            const row = worksheet.addRow([
                r.student?.student_name || 'N/A',
                r.student?.student_code || 'N/A',
                r.className || 'Unknown',
                r.presents,
                r.absents,
                r.leaves,
                r.totalSessions,
                `${r.attendanceRate}%`,
                r.notes || ''
            ]);
            row.height = 26;

            // Zebra striping
            const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

            row.eachCell((cell, colNum) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
                cell.alignment = { horizontal: colNum === 1 || colNum === 3 || colNum === 9 ? 'left' : 'center', vertical: 'middle' };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };

                // Color-code Present
                if (colNum === 4) cell.font = { ...cell.font, bold: true, color: { argb: 'FF059669' } };
                // Color-code Absent
                if (colNum === 5) cell.font = { ...cell.font, bold: true, color: { argb: 'FFDC2626' } };
                // Color-code Leave
                if (colNum === 6) cell.font = { ...cell.font, bold: true, color: { argb: 'FFD97706' } };
                // Color-code Attendance Rate
                if (colNum === 8) {
                    const rate = r.attendanceRate;
                    const color = rate >= 90 ? 'FF059669' : rate >= 70 ? 'FFD97706' : 'FFDC2626';
                    cell.font = { ...cell.font, bold: true, size: 11, color: { argb: color } };
                }
            });
        });

        // 8. Summary footer
        worksheet.addRow([]);
        const totalStudents = reportData.length;
        const avgRate = totalStudents > 0
            ? Math.round(reportData.reduce((sum: number, r: any) => sum + r.attendanceRate, 0) / totalStudents)
            : 0;
        const summaryRow = worksheet.addRow([`Total: ${totalStudents} students  •  Average Attendance Rate: ${avgRate}%  •  Generated by AAA School Management System`]);
        worksheet.mergeCells(`A${summaryRow.number}:I${summaryRow.number}`);
        summaryRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
        summaryRow.getCell(1).alignment = { horizontal: 'center' };

        // 9. Column Widths
        worksheet.getColumn(1).width = 30; // Name
        worksheet.getColumn(2).width = 15; // Code
        worksheet.getColumn(3).width = 22; // Class
        worksheet.getColumn(4).width = 10; // Present
        worksheet.getColumn(5).width = 10; // Absent
        worksheet.getColumn(6).width = 10; // Leave
        worksheet.getColumn(7).width = 16; // Total Sessions
        worksheet.getColumn(8).width = 18; // Rate
        worksheet.getColumn(9).width = 40; // Notes

        // 10. Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `AAA_Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    useEffect(() => {
        const unsubBranches = branchService.subscribe(setBranches);
        const unsubTerms = termService.subscribe(setTerms); // Subscribe to terms
        const unsubPrograms = programService.subscribe(setPrograms);
        const unsubClasses = subscribeToClasses(setClasses);
        const unsubStudents = subscribeToStudents(setStudents);

        return () => {
            unsubBranches();
            unsubTerms();
            unsubPrograms();
            unsubClasses();
            unsubStudents();
        };
    }, []);

    // Filter terms by selected branch
    const filteredTerms = useMemo(() => {
        if (!filterBranch) return terms;
        return terms.filter(t => t.branch_id === filterBranch);
    }, [terms, filterBranch]);

    // Filter programs by selected branch AND selected term
    const filteredPrograms = useMemo(() => {
        const branchPrograms = filterBranch
            ? programs.filter(p => p.branchId === filterBranch)
            : programs;
            
        // If a term is selected, only show programs associated with that term (if applicable)
        // Since terms have program_ids, we can use that for stricter filtering
        const selectedTermData = terms.find(t => t.term_id === filterTerm);
        if (selectedTermData && selectedTermData.program_ids && selectedTermData.program_ids.length > 0) {
            return branchPrograms.filter(p => selectedTermData.program_ids?.includes(p.id));
        }

        return branchPrograms;
    }, [programs, filterBranch, filterTerm, terms]);

    // Filter classes by selected branch, term, and program
    const filteredClasses = classes.filter(c => {
        if (filterBranch && c.branchId !== filterBranch) return false;
        
        // Filter by program is straightforward
        if (filterProgram && c.programId !== filterProgram) return false;

        // Filter by Term logic
        // If a term is selected, we should check if the class belongs to that term.
        // Classes don't directly have term_id, but they belong to a branch.
        // More importantly, we should use the term filter downstream for enrollments.
        // However, if we want to filter classes themselves (e.g. archived classes), current data model might not support it directly on Class object.
        // But we can filter based on whether the class has ANY enrollment in that term? No, that's circular.
        // For now, we show all classes in the branch/program. Filtering happens at enrollment level.
        
        return true;
    });

    // Subscribe to enrollments and attendance
    useEffect(() => {
        setEnrollments([]);
        setAttendanceRecords([]);

        if (filterClass) {
            const unsubEnroll = subscribeToEnrollmentsByClass(filterClass, setEnrollments);
            const unsubAttend = subscribeToAttendance(filterClass, setAttendanceRecords);
            return () => { unsubEnroll(); unsubAttend(); };
        } else if (filterBranch) {
            // If branch is selected but no class, subscribe to all visible classes
            if (filteredClasses.length === 0) return;
            
            const unsubs: (() => void)[] = [];
            filteredClasses.forEach(cls => {
                unsubs.push(subscribeToEnrollmentsByClass(cls.class_id, (data) => {
                     setEnrollments(prev => {
                         const others = prev.filter(e => e.class_id !== cls.class_id);
                         return [...others, ...data];
                     });
                }));
                unsubs.push(subscribeToAttendance(cls.class_id, (data) => {
                     setAttendanceRecords(prev => {
                         const others = prev.filter(a => a.class_id !== cls.class_id);
                         return [...others, ...data];
                     });
                }));
            });
            return () => unsubs.forEach(u => u());
        }
    }, [filterClass, filterBranch, filteredClasses.map(c => c.class_id).join(',')]); // Use ID string to avoid deep object dependency issues

    // Calculate report data
    const reportData: any[] = useMemo(() => { // Changed type to any specifically to allow adding 'notes' without strict interface check for now or update interface
        if ((!filterClass && !filterBranch) || enrollments.length === 0) return [];

        // Pre-filter enrollments if a Term is selected
        const visibleEnrollments = filterTerm 
            ? enrollments.filter(e => e.term_id === filterTerm)
            : enrollments;

        return visibleEnrollments.map(enrollment => {
            const student = students.find(s => s.student_id === enrollment.student_id);
            const studentAttendance = attendanceRecords.filter(r => r.enrollment_id === enrollment.enrollment_id);
            const enrolledClass = classes.find(c => c.class_id === enrollment.class_id); // Lookup class
            
            const totalSessions = enrolledClass?.totalSessions || 12;
            const presents = studentAttendance.filter(r => r.status === 'Present').length;
            const absents = studentAttendance.filter(r => r.status === 'Absent').length;
  /*          const leaves = studentAttendance.filter(r => r.status === 'Permission').length; */
            const leaves = studentAttendance.filter(r => r.status === 'Permission').length;
            const attendanceRate = totalSessions > 0 ? (presents / totalSessions) * 100 : 0;
            
            // Collect notes/makeup dates
            // We want to find sessions where there is a reason or special status
            const notes = studentAttendance
                .filter(r => r.reason && r.reason.trim() !== "")
                .map(r => `S${r.session_number}: ${r.reason}`)
                .join(", ");

            return {
                student: student!,
                enrollment,
                className: enrolledClass?.className || 'Unknown',
                totalSessions,
                presents,
                absents,
                leaves,
                attendanceRate: Math.round(attendanceRate),
                notes // Add notes
            };
        }).sort((a, b) => (a.student?.student_name || "").localeCompare(b.student?.student_name || ""));
    }, [enrollments, students, attendanceRecords, classes, filterClass, filterBranch, filterTerm]); // Add filterTerm dependenc

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        if (reportData.length === 0) return null;

        const totalStudents = reportData.length;
        const avgAttendanceRate = reportData.reduce((sum, r) => sum + r.attendanceRate, 0) / totalStudents;
        const goodAttendance = reportData.filter(r => r.attendanceRate >= 90).length;
        const poorAttendance = reportData.filter(r => r.attendanceRate < 70).length;

        return {
            totalStudents,
            avgAttendanceRate: Math.round(avgAttendanceRate),
            goodAttendance,
            poorAttendance
        };
    }, [reportData]);

    // Group data by class
    const groupedReportData = useMemo(() => {
        const groups: { [key: string]: StudentReport[] } = {};
        reportData.forEach(report => {
            if (!groups[report.className]) {
                groups[report.className] = [];
            }
            groups[report.className].push(report);
        });
        return groups;
    }, [reportData]);

    return (
        <div className="max-w-[1800px] mx-auto space-y-6">
            {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500">
                    <BarChart3 size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Attendance Analytics</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Reporting</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            {reportData.length} Students Tracked
                        </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                disabled={reportData.length === 0}
            >
                <Download size={20} />
                <span>Export Analytics</span>
            </button>
        </div>

        {/* Analytics Section */}
        {summaryStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-100 group transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-4 opacity-80">
                         <Users size={16} />
                         <span className="text-[10px] font-black uppercase tracking-[0.2em]">Total Students</span>
                    </div>
                    <div className="text-4xl font-black mb-1">{summaryStats.totalStudents}</div>
                    <div className="text-[10px] font-bold opacity-60">Active Enrollments</div>
                </div>

                <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-50 hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-4 text-indigo-500">
                         <TrendingUp size={16} />
                         <span className="text-[10px] font-black uppercase tracking-[0.2em]">Avg. Attendance</span>
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-1">{summaryStats.avgAttendanceRate}%</div>
                    <div className="text-[10px] font-bold text-slate-400">Class Average</div>
                </div>

                <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-emerald-50 hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-4 text-emerald-500">
                         <CheckCircle2 size={16} />
                         <span className="text-[10px] font-black uppercase tracking-[0.2em]">Excellent Status</span>
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-1">{summaryStats.goodAttendance}</div>
                    <div className="text-[10px] font-bold text-slate-400">&gt;90% Rate</div>
                </div>

                <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-rose-50 hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-4 text-rose-500">
                         <TrendingDown size={16} />
                         <span className="text-[10px] font-black uppercase tracking-[0.2em]">Critical Review</span>
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-1">{summaryStats.poorAttendance}</div>
                    <div className="text-[10px] font-bold text-slate-400">&lt;70% Rate</div>
                </div>
            </div>
        )}

        {/* FILTERS */}
        <div className="bg-white/60 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/50 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-xl">
                    <Filter size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Report Filters</h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Define your reporting criteria</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Term Selection</label>
                    <div className="relative group">
                        <select
                            value={filterTerm}
                            onChange={(e) => {
                                setFilterTerm(e.target.value);
                                const term = terms.find(t => t.term_id === e.target.value);
                                if (term) setFilterBranch(term.branch_id);
                                setFilterProgram("");
                                setFilterClass("");
                            }}
                            className="w-full pl-5 pr-10 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:bg-white"
                        >
                            <option value="">All Terms</option>
                            {terms.map(term => (
                                <option key={term.term_id} value={term.term_id}>{term.term_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-indigo-500 transition-colors" size={16} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Branch Context</label>
                    <div className="relative group">
                        <select
                            value={filterBranch}
                            onChange={(e) => {
                                setFilterBranch(e.target.value);
                                setFilterProgram("");
                                setFilterClass("");
                            }}
                            className="w-full pl-5 pr-10 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:bg-white"
                        >
                            <option value="">All Branches</option>
                            {branches.map(branch => (
                                <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Academic Program</label>
                    <div className="relative group">
                        <select
                            value={filterProgram}
                            onChange={(e) => {
                                setFilterProgram(e.target.value);
                                setFilterClass("");
                            }}
                            className="w-full pl-5 pr-10 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:bg-white"
                        >
                            <option value="">All Programs</option>
                            {filteredPrograms.map(program => (
                                <option key={program.id} value={program.id}>{program.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Classroom View</label>
                    <div className="relative group">
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="w-full pl-5 pr-10 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none cursor-pointer hover:bg-white"
                        >
                            <option value="">All Classes</option>
                            {filteredClasses.map(cls => (
                                <option key={cls.class_id} value={cls.class_id}>{cls.className}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>
        </div>

            {/* REPORT CONTENT */}
            {!filterBranch && !filterClass ? (
                <div className="glass-panel p-16 text-center">
                    <Calendar className="mx-auto text-slate-300 mb-4" size={64} />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Attendance Reports</h3>
                    <p className="text-slate-400 text-sm">Select a branch or class from the filters above to view attendance statistics and reports.</p>
                </div>
            ) : reportData.length === 0 ? (
                <div className="glass-panel p-16 text-center">
                    <Users className="mx-auto text-slate-300 mb-4" size={64} />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">No Data</h3>
                    <p className="text-slate-400 text-sm">No students found for the selected criteria.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedReportData).map(([className, classReports]) => (
                        <div key={className} className="glass-panel overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-100">
                                <h3 className="text-md font-bold text-slate-800">{className || "Unknown Class"}</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Student</th>
                                            <th className="text-center p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Present</th>
                                            <th className="text-center p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Absent</th>
                                            <th className="text-center p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Leave</th>
                                            <th className="text-center p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Total Sessions</th>
                                            <th className="text-center p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Attendance Rate</th>
                                            <th className="text-left p-4 text-xs font-black text-slate-400 uppercase tracking-wide">Notes / Make-up</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classReports.map((report) => (
                                            <tr key={report.enrollment.enrollment_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 overflow-hidden border border-slate-200">
                                                            {report.student?.image_url ? (
                                                                <img src={report.student.image_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                report.student?.student_name.charAt(0)
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">{report.student?.student_name}</p>
                                                            <p className="text-xs text-slate-400 font-semibold">{report.student?.student_code}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                                                        {report.presents}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-rose-50 text-rose-700 font-bold text-sm">
                                                        {report.absents}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-12 h-8 rounded-lg bg-amber-50 text-amber-700 font-bold text-sm">
                                                        {report.leaves}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="font-bold text-slate-600 text-sm">{report.totalSessions}</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-lg font-black ${
                                                        report.attendanceRate >= 90 ? 'text-emerald-600' :
                                                        report.attendanceRate >= 70 ? 'text-amber-600' :
                                                        'text-rose-600'
                                                    }`}>
                                                        {report.attendanceRate}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-left">
                                                    <span className="text-xs font-medium text-slate-500 block max-w-[200px] break-words">
                                                        {report.notes || "-"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
