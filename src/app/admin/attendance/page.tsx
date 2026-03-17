"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Loader2, Calendar, Clock, Users, CheckCircle2, FileText, Filter, ArrowLeft, Download, ChevronDown, Search } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

import { Term, Class, Student, Enrollment, Attendance, AttendanceStatus } from "@/lib/types";
import { termService } from "@/services/termService";
import { programService } from "@/services/programService";
import { branchService } from "@/services/branchService";
import { 
    subscribeToClasses, 
    subscribeToStudents,
    subscribeToEnrollmentsByClass,
    subscribeToAttendance,
    recordAttendance,
    updateAttendanceStatus
} from "@/lib/services/schoolService";
import { AttendanceCell } from "@/components/attendance/AttendanceCell";
import { useAttendanceLocking } from "@/hooks/useAttendanceLocking";
import { exportToExcel } from "@/utils/exportUtils";

// Helper function to calculate session dates based on class schedule
function calculateSessionDates(
    startDate: string, 
    endDate: string, 
    classDays: string[], 
    totalSessions: number
): Record<number, string> {
    const dayMap: Record<string, number> = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    const scheduledDayNumbers = classDays.map(day => dayMap[day]).filter(d => d !== undefined);
    
    const sessionDates: Record<number, string> = {};
    let sessionNumber = 1;
    let currentDate = new Date(start);

    while (currentDate <= end && sessionNumber <= totalSessions) {
        const dayOfWeek = currentDate.getDay();
        
        if (scheduledDayNumbers.includes(dayOfWeek)) {
            sessionDates[sessionNumber] = currentDate.toISOString().split('T')[0];
            sessionNumber++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessionDates;
}

export default function TrackAttendancePage() {
    const { profile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [branches, setBranches] = useState<any[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
    const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
    
    // Filter State
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [selectedTerm, setSelectedTerm] = useState<string>("");
    const [selectedProgram, setSelectedProgram] = useState<string>(""); 
    const [selectedDay, setSelectedDay] = useState<string>(""); 
    const [selectedClass, setSelectedClass] = useState<string>(""); 
    const [showInactive, setShowInactive] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    
    const [loading, setLoading] = useState(true);
    const { lockedSessions, setLockedSessions, initializeLocks, toggleLock, isLocked } = useAttendanceLocking();
    const [sessionDates, setSessionDates] = useState<Record<string, Record<number, string>>>({});
    
    // Export Dropdown State
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        scope: 'current',
        showId: false, // Default per request
        showStats: false, // Default per request
        showLegend: true
    });

    // Fetch initial data
    useEffect(() => {
        if (!profile) return;

        const branchIds: string[] = []; // Both admin and superAdmin see all

        const unsubBranches = branchService.subscribe(setBranches, branchIds);
        const unsubTerms = termService.subscribe(setTerms, branchIds);
        const unsubPrograms = programService.subscribe(setPrograms);
        const unsubClasses = subscribeToClasses(setClasses, branchIds);
        const unsubStudents = subscribeToStudents(setStudents, branchIds);

        setLoading(false);

        return () => {
            unsubBranches();
            unsubTerms();
            unsubPrograms();
            unsubClasses();
            unsubStudents();
        };
    }, [profile]);

    // Initialize from URL params or Default to Active Term
    // Initialize from URL params - Removed auto-select default
    useEffect(() => {
        const termId = searchParams.get('termId');
        if (termId) {
             setSelectedTerm(termId);
        }
    }, [searchParams]);

    // Handle Branch Auto-selection when Term changes
    useEffect(() => {
        if (selectedTerm) {
            const term = terms.find(t => t.term_id === selectedTerm);
            if (term) setSelectedBranch(term.branch_id);
        }
    }, [selectedTerm, terms]);

    // Get current term data
    const currentTerm = useMemo(() => {
        return terms.find(t => t.term_id === selectedTerm) || null;
    }, [terms, selectedTerm]);

    // Filter terms by selected branch
    const filteredTerms = useMemo(() => {
        if (!selectedBranch) return terms;
        return terms.filter(t => t.branch_id === selectedBranch);
    }, [terms, selectedBranch]);

    // Filter programs by term's program_ids
    // Filter programs by term's program_ids OR selected branch OR all
    const filteredPrograms = useMemo(() => {
        if (currentTerm && currentTerm.program_ids) {
            return programs.filter(p => currentTerm.program_ids.includes(p.id));
        }
        if (selectedBranch) {
            // Find programs associated with any term in this branch
            const branchTermProgramIds = terms
                .filter(t => t.branch_id === selectedBranch)
                .flatMap(t => t.program_ids || []);
            
            // Find programs that have at least one class in this branch
            const branchClassProgramIds = classes
                .filter(cls => cls.branchId === selectedBranch)
                .map(cls => cls.programId);

            const validIds = new Set([...branchTermProgramIds, ...branchClassProgramIds]);

            return programs.filter(p => 
                p.branchId === selectedBranch || 
                validIds.has(p.id)
            );
        }
        return programs;
    }, [programs, currentTerm, selectedBranch, terms, classes]);

    // Filter classes by term's branch, selected program, and selected day
    // Filter classes by term's branch, selected program, and selected day
    const filteredClasses = useMemo(() => {
        return classes.filter(cls => {
            // Filter by Term if selected (ensure class branch matches term branch)
            if (currentTerm && cls.branchId !== currentTerm.branch_id) return false;
            
            // Filter by Branch if selected
            if (selectedBranch && cls.branchId !== selectedBranch) return false;
            
            // Filter by Program if selected
            if (selectedProgram && cls.programId !== selectedProgram) return false;
            
            // Filter by Day if selected
            if (selectedDay && !cls.days.includes(selectedDay)) return false;
            
            return true;
        });
    }, [classes, currentTerm, selectedBranch, selectedProgram, selectedDay]);

    // Get the specific classes to display (handle Class filter)
    const displayClasses = useMemo(() => {
        if (!selectedClass) return filteredClasses;
        return filteredClasses.filter(cls => cls.class_id === selectedClass);
    }, [filteredClasses, selectedClass]);

    // Auto-calculate session dates when relevant data changes
    // Auto-calculate session dates when relevant data changes
    useEffect(() => {
        if (filteredClasses.length === 0) return;

        const newSessionDates: Record<string, Record<number, string>> = {};
        
        filteredClasses.forEach(cls => {
            // Use current term if selected, otherwise find active term for the branch
            let term = currentTerm;
            if (!term) {
                term = terms.find(t => t.branch_id === cls.branchId && t.status === 'Active') || null;
            }

            if (term) {
                const dates = calculateSessionDates(
                    term.start_date,
                    term.end_date,
                    cls.days,
                    cls.totalSessions || 12
                );
                newSessionDates[cls.class_id] = dates;
            }
        });
        
        setSessionDates(newSessionDates);
    }, [currentTerm, filteredClasses, terms]);

    // Subscribe to all enrollments and attendance for filtered classes
    useEffect(() => {
        if (filteredClasses.length === 0) {
            setAllEnrollments([]);
            setAllAttendance([]);
            return;
        }

        const unsubscribers: (() => void)[] = [];
        
        filteredClasses.forEach(cls => {
            const unsubEnroll = subscribeToEnrollmentsByClass(cls.class_id, (enrollments) => {
                setAllEnrollments(prev => {
                    const filtered = prev.filter(e => e.class_id !== cls.class_id);
                    return [...filtered, ...enrollments];
                });
            });
            
            const unsubAttend = subscribeToAttendance(cls.class_id, (attendance) => {
                setAllAttendance(prev => {
                    const filtered = prev.filter(a => a.class_id !== cls.class_id);
                    return [...filtered, ...attendance];
                });
            });

            unsubscribers.push(unsubEnroll, unsubAttend);
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [filteredClasses]);

    // Auto-lock sessions that have attendance data
    useEffect(() => {
        initializeLocks(filteredClasses, allAttendance);
    }, [allAttendance, filteredClasses, initializeLocks]);

    const getClassEnrollments = (classId: string) => {
        return allEnrollments
            .filter(e => e.class_id === classId && (showInactive || (e.enrollment_status === 'Active' || !e.enrollment_status)))
            .map(enrollment => {
                const student = students.find(s => s.student_id === enrollment.student_id);
                const attendance = allAttendance.filter(r => r.enrollment_id === enrollment.enrollment_id);
                return { enrollment, student, attendance };
            })
            .filter(item => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                    item.student?.student_name.toLowerCase().includes(query) ||
                    item.student?.student_code.toLowerCase().includes(query)
                );
            })
            .sort((a, b) => (a.student?.student_name || "").localeCompare(b.student?.student_name || ""));
    };

    const handleStatusChange = async (
        classId: string,
        enrollmentId: string,
        studentId: string,
        sessionNumber: number,
        status: AttendanceStatus,
        existingRecordId?: string,
        reason?: string
    ) => {
        try {
            const dates = sessionDates[classId] || {};
            const date = dates[sessionNumber] || new Date().toISOString().split("T")[0];

            if (existingRecordId) {
                await updateAttendanceStatus(existingRecordId, status, reason);
            } else {
                await recordAttendance({
                    enrollment_id: enrollmentId,
                    class_id: classId,
                    student_id: studentId,
                    session_number: sessionNumber,
                    session_date: date,
                    status,
                    reason: reason || "",
                });
            }
        } catch (err) {
            console.error("Attendance update failed", err);
        }
    };

    const handleMarkAllPresent = (classId: string, sessionNumber: number) => {
        const enrollments = getClassEnrollments(classId);
        enrollments.forEach(item => {
            const record = item.attendance.find(r => r.session_number === sessionNumber);
            handleStatusChange(
                classId,
                item.enrollment.enrollment_id,
                item.student!.student_id,
                sessionNumber,
                'Present',
                record?.attendance_id,
                ""
            );
        });
    };

    const handleDateChange = (classId: string, sessionNum: number, date: string) => {
        setSessionDates(prev => ({
            ...prev,
            [classId]: {
                ...(prev[classId] || {}),
                [sessionNum]: date
            }
        }));
    };

    // Calculate Present Stats
    const { presentCount, latestDateLabel } = useMemo(() => {
        if (displayClasses.length === 0) return { presentCount: 0, latestDateLabel: 'Today' };

        // Robust gathering of records via Enrollment IDs
        const relevantRecords: Attendance[] = [];
        displayClasses.forEach(cls => {
            const classEnrollments = allEnrollments.filter(e => e.class_id === cls.class_id);
            const enrollmentIds = classEnrollments.map(e => e.enrollment_id);
            const classAttendance = allAttendance.filter(a => enrollmentIds.includes(a.enrollment_id));
            relevantRecords.push(...classAttendance);
        });

        if (relevantRecords.length === 0) return { presentCount: 0, latestDateLabel: 'Today' };

        // Find latest date with any records
        const dates = Array.from(new Set(relevantRecords.map(r => r.session_date)));
        dates.sort();
        const latestDate = dates[dates.length - 1];
        
        const count = relevantRecords.filter(a => a.session_date === latestDate && a.status === 'Present').length;
        
        const today = new Date().toISOString().split('T')[0];
        let label = 'Today';
        if (latestDate !== today && latestDate) {
             label = new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        return { presentCount: count, latestDateLabel: label };
    }, [allAttendance, allEnrollments, displayClasses]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    const generateExportHTML = (classData: any, isPrint: boolean, options: any) => {
        const enrollments = getClassEnrollments(classData.class_id);
        const dates = sessionDates[classData.class_id] || {};
        const totalSessions = classData.totalSessions || 12;
        const termName = currentTerm ? currentTerm.term_name : (terms.find(t => t.term_id === selectedTerm)?.term_name || 'All Terms');

        return `
            <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
                <div style="margin-bottom: 10px; border: 1px solid #ddd; padding: 15px; background: #f9fafb;">
                    <h2 style="margin: 0 0 5px 0; font-size: 18px;">${classData.className}</h2>
                    <p style="margin: 0; font-size: 14px; color: #666;">
                        Term: <strong>${termName}</strong> | Schedule: ${classData.days.join(", ")} (${classData.startTime} - ${classData.endTime})
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr>
                            ${options.showId ? '<th style="border: 1px solid #ddd; padding: 8px; background: #4F46E5; color: white;">ID</th>' : ''}
                            <th style="border: 1px solid #ddd; padding: 8px; background: #4F46E5; color: white; text-align: left;">Student Name</th>
                            ${Array.from({ length: totalSessions }).map((_, i) => {
                                const date = dates[i + 1] ? new Date(dates[i + 1]).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '';
                                return `<th style="border: 1px solid #ddd; padding: 4px; background: #4F46E5; color: white; min-width: 40px;">S${i + 1}<br/><span style="font-size: 9px; font-weight: normal;">${date}</span></th>`;
                            }).join('')}
                            ${options.showStats ? `
                                <th style="border: 1px solid #ddd; padding: 8px; background: #4F46E5; color: white;">Present</th>
                                <th style="border: 1px solid #ddd; padding: 8px; background: #4F46E5; color: white;">Absent</th>
                            `: ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${enrollments.map(item => {
                            let present = 0;
                            let absent = 0;
                            
                            const sessionCells = Array.from({ length: totalSessions }).map((_, i) => {
                                const record = item.attendance.find(r => r.session_number === i + 1);
                                const status = record?.status || '-';
                                
                                if (status === 'Present') present++;
                                if (status === 'Absent') absent++;
                                
                                let display = '-';
                                let bg = '#fff';
                                let color = '#000';

                                if (status === 'Present') { display = 'P'; color = '#059669'; bg = '#ecfdf5'; }
                                else if (status === 'Absent') { display = 'A'; color = '#dc2626'; bg = '#fef2f2'; }
                                else if (status === 'Permission') { display = 'L'; color = '#d97706'; bg = '#fffbeb'; }
                                
                                return `<td style="border: 1px solid #ddd; padding: 4px; text-align: center; color: ${color}; background: ${bg}; font-weight: bold;">${display}</td>`;
                            }).join('');

                            return `
                                <tr>
                                    ${options.showId ? `<td style="border: 1px solid #ddd; padding: 8px;">${item.student?.student_code || ''}</td>` : ''}
                                    <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${item.student?.student_name}</td>
                                    ${sessionCells}
                                    ${options.showStats ? `
                                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${present}</td>
                                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #dc2626;">${absent}</td>
                                    `: ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ${options.showLegend ? `
                    <div style="margin-top: 5px; font-size: 8px; color: #666; text-align: right;">
                        <strong>Legend:</strong> P = Present, A = Absent, L = Permission (Leave)
                    </div>
                ` : ''}
            </div>
        `;
    };

    const handlePrint = () => {
        // Hardcoded options for Print
        const options = {
            scope: 'current',
            showId: false,
            showStats: false,
            showLegend: true
        };

        // Filter out classes with no students
        const classesToExport = displayClasses.filter(cls => getClassEnrollments(cls.class_id).length > 0); 
        
        if (classesToExport.length === 0) {
            alert("No classes with students to print.");
            return;
        } 
        
        const termName = currentTerm ? currentTerm.term_name.toUpperCase() : (terms.find(t => t.term_id === selectedTerm)?.term_name.toUpperCase() || 'ALL TERMS');

        // CSS for Landscape and Stacked Layout
        let content = `
            <html>
            <head>
                <title>Attendance Report</title>
                <style>
                    @page { 
                        size: landscape; 
                        margin: 10mm; 
                    }
                    * { 
                        box-sizing: border-box; 
                    }
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        -webkit-print-color-adjust: exact; 
                        margin: 0;
                        padding: 10mm;
                        font-size: 11px;
                        width: 100%;
                    }
                    .main-title {
                        text-align: center;
                        font-weight: 900;
                        font-size: 18px;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                        color: #000;
                    }
                    .sub-title {
                        text-align: center;
                        font-weight: bold;
                        font-size: 14px;
                        margin-bottom: 30px;
                        color: #333;
                        border-bottom: 2px solid #000;
                        padding-bottom: 15px;
                    }
                    .class-container {
                        width: 100%;
                        margin-bottom: 0px !important;
                        padding-bottom: 0px !important;
                        page-break-inside: avoid;
                        display: block;
                        clear: both;
                    }
                    .class-header {
                        background-color: #1e40af !important;
                        padding: 6px 12px;
                        font-weight: bold;
                        border: 1px solid #000;
                        border-bottom: none;
                        font-size: 11px;
                        text-transform: uppercase;
                        color: #ffffff !important;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                    }
                    th, td { 
                        border: 1px solid #000; 
                        padding: 4px; 
                        text-align: center;
                        font-size: 10px;
                    }
                    th {
                        background-color: #f8fafc;
                        color: #000;
                        font-weight: bold;
                    }
                    .status-p { color: #16a34a; font-weight: 900; }
                    .status-a { color: #dc2626; font-weight: 900; }
                    .status-l { color: #d97706; font-weight: 900; }
                    .student-name {
                        text-align: left;
                        padding-left: 8px;
                        font-weight: bold;
                        width: 200px;
                    }
                    .session-header {
                        min-width: 35px;
                    }
                    .date-sub {
                        font-size: 8px;
                        font-weight: normal;
                        display: block;
                        margin-top: 2px;
                    }
                    
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="main-title">Student Attendance List</div>
                <div class="sub-title">Term: ${termName}</div>
        `;

        classesToExport.forEach(cls => {
            const enrollments = getClassEnrollments(cls.class_id);
            const dates = sessionDates[cls.class_id] || {};
            const totalSessions = cls.totalSessions || 12;
            
            content += `
                <div class="class-container">
                    <div class="class-header">
                        Class Schedule: ${cls.className} (${cls.days.join(", ")} ${cls.startTime} - ${cls.endTime})
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px;">No.</th>
                                <th class="student-name">Student Name</th>
                                <th style="width: 100px;">Session</th>
                                ${Array.from({ length: totalSessions }).map((_, i) => {
                                    const date = dates[i + 1] ? new Date(dates[i + 1]).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : '';
                                    return `
                                        <th class="session-header">
                                            ${date ? `<span class="date-sub">${date}</span>` : ''}
                                        </th>
                                    `;
                                }).join('')}
                                <th style="width: 100px;">Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${enrollments.map((item, idx) => {
                                const sessionCells = Array.from({ length: totalSessions }).map((_, i) => {
                                    const record = item.attendance.find(r => r.session_number === i + 1);
                                     const s = (record?.status || '').toLowerCase();
                                     let display = '';
                                     let statusClass = '';
                                     
                                     if (s === 'present' || s === 'p') { 
                                         display = 'P'; 
                                         statusClass = 'status-p';
                                     }
                                     else if (s === 'absent' || s === 'a') { 
                                         display = 'A'; 
                                         statusClass = 'status-a';
                                     }
                                     else if (s === 'permission' || s === 'l' || s === 'leave') { 
                                         display = 'L'; 
                                         statusClass = 'status-l';
                                     }
                                     
                                     return `<td class="${statusClass}">${display}</td>`;
                                }).join('');

                                return `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td class="student-name">
                                            ${item.student?.student_name.toUpperCase()}
                                        </td>
                                        <td style="font-size: 10px; font-weight: bold; color: #475569; text-align: center;">
                                            ${(cls.totalSessions || 12) - (item.enrollment.start_session || 1) + 1} Session
                                        </td>
                                        ${sessionCells}
                                        <td></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        content += `
            <div style="margin-top: 20px; font-size: 10px; font-weight: bold; border-top: 1px solid #000; padding-top: 10px;">
                * Note: P = Present, A = Absent, L = Permission (Leave)
            </div>
        </body></html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    const handleExportExcel = () => {
        // Hardcoded options for Excel
        const options = {
            scope: 'current',
            showId: false, 
            showStats: false, 
            showLegend: true
        };
        
        // Filter out classes with no students
        const classesToExport = displayClasses.filter(cls => getClassEnrollments(cls.class_id).length > 0); 
        
        if (classesToExport.length === 0) {
            alert("No classes with students to export.");
            return;
        }

        let content = "";
        classesToExport.forEach(cls => {
            content += generateExportHTML(cls, false, options);
        });
        
        const fileName = `Attendance_${options.scope}_${new Date().toISOString().split('T')[0]}`;
        exportToExcel(fileName, content);
    };


    return (
        <div className="w-full max-w-[1800px] mx-auto space-y-10 pb-20 font-sans">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => router.back()}
                        className="group w-14 h-14 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 active:scale-95"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Attendance</h1>

                    </div>
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setShowExportDropdown(!showExportDropdown)}
                        disabled={displayClasses.length === 0}
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        <FileText size={20} />
                        <span>Export / Print</span>
                        <ChevronDown size={18} className={`transition-transform duration-300 ${showExportDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showExportDropdown && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setShowExportDropdown(false)} />
                            <div className="absolute top-full right-0 mt-4 w-64 bg-white/90 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-30 p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                <button
                                    onClick={() => { handlePrint(); setShowExportDropdown(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-indigo-50 text-indigo-700 transition-all text-sm font-bold"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                        <FileText size={16} />
                                    </div>
                                    <span>Print View</span>
                                </button>
                                <button
                                    onClick={() => { handleExportExcel(); setShowExportDropdown(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-emerald-50 text-emerald-700 transition-all text-sm font-bold"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <Download size={16} />
                                    </div>
                                    <span>Export Excel</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Filter & Search Bar Section */}
            <div className="bg-white/60 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/50 shadow-sm transition-all duration-300">
                <div className="flex flex-col xl:flex-row items-center gap-4 sm:gap-6 mb-4 sm:mb-8">
                    {/* Search Bar */}
                    <div className="flex-1 w-full md:max-w-[300px] group relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-6 pr-12 py-3.5 bg-white border border-slate-200 rounded-[1.25rem] text-xs sm:text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400 shadow-sm"
                        />
                        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                            <Search className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={22} />
                        </div>
                    </div>
                    
                    {/* Term Info Display if selected */}
                    {currentTerm && (
                        <div className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-indigo-50 border border-indigo-100 rounded-xl sm:rounded-2xl flex items-center gap-3">
                            <Calendar size={16} className="text-indigo-600 sm:hidden" />
                            <Calendar size={18} className="text-indigo-600 hidden sm:block" />
                            <div>
                                <p className="text-[8px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-tight">Selected Term</p>
                                <p className="text-xs sm:text-sm font-black text-indigo-900 leading-tight">{currentTerm.term_name}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                    {/* Branch Select */}
                    <div className="group">
                        <label className="block text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 ml-1 group-focus-within:text-indigo-600 transition-colors">Branch</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => {
                                setSelectedBranch(e.target.value);
                                setSelectedTerm(""); 
                                setSelectedProgram("");
                                setSelectedDay("");
                                setSelectedClass("");
                            }}
                            className="w-full px-5 py-3 sm:px-6 sm:py-4 bg-white/50 border border-slate-200/60 rounded-xl sm:rounded-[1.25rem] text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white hover:border-slate-300"
                        >
                            <option value="">All Branches</option>
                            {branches.map(branch => (
                                <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Term Select */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-indigo-600 transition-colors">Academic Term</label>
                        <select
                            value={selectedTerm}
                            onChange={(e) => {
                                setSelectedTerm(e.target.value);
                                setSelectedProgram("");
                                setSelectedDay("");
                                setSelectedClass("");
                            }}
                            className="w-full px-6 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white hover:border-slate-300"
                        >
                            <option value="">All Terms</option>
                            {filteredTerms.map(term => (
                                <option key={term.term_id} value={term.term_id}>{term.term_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Program Select */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-indigo-600 transition-colors">Program</label>
                        <select
                            value={selectedProgram}
                            onChange={(e) => {
                                setSelectedProgram(e.target.value);
                                setSelectedDay(""); 
                                setSelectedClass("");
                            }}
                            className="w-full px-6 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white hover:border-slate-300"
                        >
                            <option value="">All Programs</option>
                            {filteredPrograms.map(program => (
                                <option key={program.id} value={program.id}>{program.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Day Select */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-indigo-600 transition-colors">Day of Week</label>
                        <select
                            value={selectedDay}
                            onChange={(e) => {
                                setSelectedDay(e.target.value);
                                setSelectedClass("");
                            }}
                            className="w-full px-6 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white hover:border-slate-300"
                        >
                            <option value="">All Days</option>
                            <option value="Sunday">Sunday</option>
                            <option value="Monday">Monday</option>
                            <option value="Tuesday">Tuesday</option>
                            <option value="Wednesday">Wednesday</option>
                            <option value="Thursday">Thursday</option>
                            <option value="Friday">Friday</option>
                            <option value="Saturday">Saturday</option>
                        </select>
                    </div>

                    {/* Class Select */}
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within:text-indigo-600 transition-colors">Specific Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full px-6 py-4 bg-white/50 border border-slate-200/60 rounded-[1.25rem] text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all cursor-pointer hover:bg-white hover:border-slate-300"
                        >
                            <option value="">All Classes</option>
                            {filteredClasses.map(cls => (
                                <option key={cls.class_id} value={cls.class_id}>
                                    {cls.className} ({cls.startTime} - {cls.endTime})
                                </option>
                            ))}
                        </select>
                    </div>


                </div>
            </div>

            {/* Attendance Stats Cards */}
            {displayClasses.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-5 text-white shadow-lg shadow-indigo-100 group transition-all duration-500 hover:scale-[1.02]">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <Users size={20} />
                                </div>
                                <h3 className="text-[11px] font-black uppercase tracking-widest opacity-80">Total Students</h3>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black">
                                    ${displayClasses.reduce((sum, cls) => sum + getClassEnrollments(cls.class_id).length, 0)}
                                </span>
                                <span className="text-xs font-bold opacity-60">in view</span>
                            </div>
                        </div>
                        <Users size={80} className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform duration-700" />
                    </div>

                    <div className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-5 shadow-sm group transition-all duration-500 hover:shadow-md hover:scale-[1.02]">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <CheckCircle2 size={20} />
                                </div>
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Present</h3>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 tracking-tight">
                                    {presentCount}
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-emerald-600 font-black text-[9px] uppercase tracking-wider">Latest</span>
                                    <span className="text-slate-400 font-bold text-[9px]">{latestDateLabel}</span>
                                </div>
                            </div>
                        </div>
                        <CheckCircle2 size={70} className="absolute -right-4 -bottom-4 text-emerald-500/5 group-hover:scale-110 transition-transform duration-700" />
                    </div>

                    <div className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-5 shadow-sm group transition-all duration-500 hover:shadow-md hover:scale-[1.02]">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <BookOpen size={20} />
                                </div>
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Classes</h3>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 tracking-tight">
                                    {displayClasses.length}
                                </span>
                                <span className="text-indigo-600 font-black text-[9px] uppercase tracking-wider">Active View</span>
                            </div>
                        </div>
                        <BookOpen size={70} className="absolute -right-4 -bottom-4 text-indigo-500/5 group-hover:scale-110 transition-transform duration-700" />
                    </div>
                </div>
            )}

            {/* Empty State */}
            {displayClasses.length === 0 ? (
                <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-20 border border-white/50 shadow-sm transition-all duration-300 text-center group">
                    <div className="w-24 h-24 rounded-[2rem] bg-indigo-50 text-indigo-200 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:text-indigo-600 transition-all duration-500 shadow-inner">
                        <BookOpen size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">No Classes Found</h3>
                    <p className="text-slate-500 font-bold max-w-md mx-auto leading-relaxed">
                        We couldn't find any classes matching your current filters. Try adjusting your selection or search criteria.
                    </p>
                    <div className="mt-10 inline-flex items-center gap-2 p-3 bg-white/50 rounded-2xl border border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-widest shadow-sm">
                         <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                         <span>Debug: Term={currentTerm?.term_name || 'All'} • Program={selectedProgram || 'All'}</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {displayClasses.map(cls => (
                        <div key={cls.class_id} className="bg-white/70 backdrop-blur-md rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-white/50 overflow-hidden group/class hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500">
                            {/* Class Header */}
                            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white/50">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover/class:scale-110 transition-transform duration-500">
                                            <BookOpen size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{cls.className}</h3>
                                            <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white rounded-full px-3 py-1 border border-slate-100 shadow-sm">
                                                    <Clock size={14} className="text-indigo-500" />
                                                    <span>{cls.startTime} - {cls.endTime}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white rounded-full px-3 py-1 border border-slate-100 shadow-sm">
                                                    <Calendar size={14} className="text-emerald-500" />
                                                    <span>{cls.days.join(", ")}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 px-4 flex items-center gap-2 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-700 font-black text-sm transition-all group-hover/class:bg-indigo-600 group-hover/class:text-white group-hover/class:shadow-lg group-hover/class:shadow-indigo-100">
                                            <Users size={18} />
                                            <span>{getClassEnrollments(cls.class_id).length} Students</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Attendance Table with Horizontal Scroll */}
                            <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
                                <div className="min-w-[1200px]">
                                    <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 z-30 bg-white/90 backdrop-blur-md p-6 min-w-[300px] border-b border-r border-slate-100 shadow-[10px_0_30px_rgba(0,0,0,0.03)]">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Information</div>
                                            </th>
                                            {Array.from({ length: cls.totalSessions || 12 }).map((_, i) => {
                                                const sessionNum = i + 1;
                                                const sessionDate = sessionDates[cls.class_id]?.[sessionNum];
                                                const formattedDate = sessionDate 
                                                    ? new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                    : '';
                                                
                                                return (
                                                    <th key={i} className={`p-4 min-w-[140px] border-b border-r border-slate-50/50 last:border-r-0 transition-all ${isLocked(cls.class_id, sessionNum) ? 'bg-slate-50/80 cursor-not-allowed' : 'bg-white/40'}`}>
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex items-center justify-center gap-2 w-full">
                                                                <span className="text-[11px] font-black text-slate-400">S{sessionNum}</span>
                                                                <button
                                                                    onClick={() => toggleLock(cls.class_id, sessionNum)}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-300 ${
                                                                        isLocked(cls.class_id, sessionNum)
                                                                            ? 'text-slate-400 bg-slate-100 border border-slate-200' 
                                                                            : 'text-indigo-400 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-100'
                                                                    }`}
                                                                    title={isLocked(cls.class_id, sessionNum) ? "Unlock Session" : "Lock Session"}
                                                                >
                                                                    {isLocked(cls.class_id, sessionNum) ? (
                                                                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                    ) : (
                                                                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                                                                    )}
                                                                </button>
                                                            </div>

                                                            {formattedDate ? (
                                                                <div className="text-[10px] font-black text-indigo-600 bg-white border border-indigo-50 px-3 py-1.5 rounded-full shadow-sm">
                                                                    {formattedDate}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] font-black text-slate-300 px-3 py-1.5">No Date</div>
                                                            )}
                                                            
                                                            {!isLocked(cls.class_id, sessionNum) && (
                                                                <button
                                                                    onClick={() => handleMarkAllPresent(cls.class_id, sessionNum)}
                                                                    className="w-full text-[9px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg border border-emerald-100 transition-all duration-300"
                                                                >
                                                                    MARK ALL
                                                                </button>
                                                            )}

                                                            <input
                                                                type="date"
                                                                className={`w-full bg-white/50 border border-slate-100 hover:border-indigo-200 text-center text-[10px] font-bold text-slate-500 rounded-xl py-2 outline-none transition-all ${isLocked(cls.class_id, sessionNum) ? 'cursor-not-allowed opacity-50' : 'focus:ring-2 focus:ring-indigo-100'}`}
                                                                value={sessionDate || ""}
                                                                onChange={(e) => handleDateChange(cls.class_id, sessionNum, e.target.value)}
                                                                disabled={isLocked(cls.class_id, sessionNum)}
                                                            />
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getClassEnrollments(cls.class_id).length === 0 ? (
                                            <tr>
                                                <td colSpan={(cls.totalSessions || 12) + 1} className="p-8 text-center text-slate-400 text-sm">
                                                    No students enrolled in this class
                                                </td>
                                            </tr>
                                        ) : (
                                            getClassEnrollments(cls.class_id).map((item) => (
                                                <tr key={item.enrollment.enrollment_id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                                    <td className="sticky left-0 z-20 bg-white/90 backdrop-blur-md group-hover:bg-slate-50/80 p-6 border-b border-r border-slate-100 shadow-[10px_0_30px_rgba(0,0,0,0.02)] transition-all duration-300">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-[1.25rem] bg-slate-100 flex items-center justify-center text-sm font-black text-slate-400 overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                                                                {item.student?.image_url ? (
                                                                    <img src={item.student.image_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    item.student?.student_name.charAt(0)
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 text-sm tracking-tight">{item.student?.student_name}</p>
                                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">{item.student?.student_code}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {Array.from({ length: cls.totalSessions || 12 }).map((_, i) => {
                                                        const sessionNum = i + 1;
                                                        const record = item.attendance.find(r => r.session_number === sessionNum);
                                                        return (
                                                            <td key={i} className="p-2 border-b border-r border-slate-50 last:border-r-0">
                                                                <AttendanceCell 
                                                                    record={record} 
                                                                    onChange={(status, reason) => handleStatusChange(
                                                                        cls.class_id,
                                                                        item.enrollment.enrollment_id,
                                                                        item.student!.student_id,
                                                                        sessionNum,
                                                                        status as AttendanceStatus,
                                                                        record?.attendance_id,
                                                                        reason
                                                                    )}
                                                                    readOnly={isLocked(cls.class_id, sessionNum)}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
