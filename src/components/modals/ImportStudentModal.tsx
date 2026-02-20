"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Search, Download, Edit2, Check, AlertTriangle, Trash2, RotateCcw, Folder } from "lucide-react";
import * as XLSX from "xlsx";
import { Student, Branch, Gender, StudentStatus, Program, Class, Term } from "@/lib/types";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { addStudent, getClasses, addEnrollment } from "@/lib/services/schoolService";

interface ImportStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedStudent {
    student_name: string;
    first_name: string;
    last_name: string;
    gender: Gender;
    dob: string;
    pob: string;
    nationality: string;
    phone: string;
    parent_phone: string;
    branch_name: string;
    branch_id?: string;
    program_name: string;
    program_id?: string;
    class_name: string;
    class_id?: string;
    address: string;
    status: StudentStatus;
    father_name: string;
    mother_name: string;
    isValid: boolean;
    errors: string[];
}

type ImportStep = 'upload' | 'preview' | 'confirm' | 'importing' | 'summary';

export default function ImportStudentModal({ isOpen, onClose, onSuccess }: ImportStudentModalProps) {
    const [step, setStep] = useState<ImportStep>('upload');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [results, setResults] = useState({ success: 0, failed: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editing state
    const [editingCell, setEditingCell] = useState<{ index: number; field: keyof ParsedStudent } | null>(null);


    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        
        if (isOpen) {
            branchService.getAll().then(setBranches);
            programService.getAll().then(setPrograms);
            getClasses().then(setClasses);
            termService.subscribe(setTerms);
        } else {
            // Reset state when closing
            setStep('upload');
            setParsedData([]);
            setSelectedFile(null);
            setUploadProgress(0);
            setResults({ success: 0, failed: 0 });
            setEditingCell(null);
        }

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let file: File | undefined;
        if ('files' in e.target && e.target.files) {
            file = e.target.files[0];
        } else if ('dataTransfer' in e && e.dataTransfer.files) {
            file = e.dataTransfer.files[0];
        }

        if (!file) return;
        
        setSelectedFile(file);
        setUploadProgress(0);

        // Simulate upload progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setUploadProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                
                // Process the data after "upload" finishes
                const reader = new FileReader();
                reader.onload = (event) => {
                    const bstr = event.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws);
                    processImportData(data);
                };
                reader.readAsBinaryString(file!);
            }
        }, 150);
    };

    const validateStudent = (student: Partial<ParsedStudent>) => {
        const errors: string[] = [];
        if (!student.student_name && (!student.first_name || !student.last_name)) errors.push('Name is required');
        if (!student.branch_name) errors.push('Branch is required');
        
        // Check if branch exists
        const branch = branches.find(b => b.branch_name.toLowerCase() === student.branch_name?.toLowerCase());
        if (student.branch_name && !branch) {
            errors.push(`Branch "${student.branch_name}" not found`);
        } else if (branch) {
            student.branch_id = branch.branch_id;
        }

        // Program Validation
        if (student.program_name) {
            const program = programs.find(p => p.name.toLowerCase() === student.program_name?.toLowerCase() && (!branch || p.branchId === branch.branch_id));
            if (!program) {
                errors.push(`Program "${student.program_name}" not found in this branch`);
                student.program_id = undefined;
            } else {
                student.program_id = program.id;
                
                // Class Validation within Branch & Program
                if (student.class_name) {
                    const cls = classes.find(c => 
                        c.className.toLowerCase() === student.class_name?.toLowerCase() &&
                        c.branchId === branch?.branch_id &&
                        c.programId === program.id
                    );
                    if (!cls) {
                        errors.push(`Class "${student.class_name}" not found in this Branch/Program`);
                        student.class_id = undefined;
                    } else {
                        student.class_id = cls.class_id;
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    const processImportData = (data: any[]) => {
        const processed = data.map((row: any) => {
            const name = (row['Name'] || row['student_name'] || '').toString().trim();
            const firstName = (row['First Name'] || row['first_name'] || '').toString().trim();
            const lastName = (row['Last Name'] || row['last_name'] || '').toString().trim();
            const branchName = (row['Branch'] || row['branch_name'] || '').toString().trim();
            const programName = (row['Program'] || row['program_name'] || '').toString().trim();
            const className = (row['Class'] || row['class_name'] || '').toString().trim();
            
            // Gender mapping
            let gender: Gender = 'Male';
            const genderInput = (row['Gender'] || row['gender'] || '').toString().toLowerCase();
            if (genderInput.startsWith('f')) gender = 'Female';

            const student: ParsedStudent = {
                student_name: name || `${firstName} ${lastName}`.trim(),
                first_name: firstName || name.split(' ')[0] || '',
                last_name: lastName || name.split(' ').slice(1).join(' ') || '',
                gender,
                dob: (row['DOB'] || row['dob'] || '').toString(),
                pob: (row['POB'] || row['pob'] || row['Place of Birth'] || '').toString(),
                nationality: (row['Nationality'] || row['nationality'] || 'Cambodian').toString(),
                phone: (row['Phone'] || row['phone'] || '').toString(),
                parent_phone: (row['Parent Phone'] || row['parent_phone'] || '').toString(),
                branch_name: branchName,
                program_name: programName,
                class_name: className,
                address: (row['Address'] || row['address'] || '').toString(),
                status: 'Active' as StudentStatus,
                father_name: (row['Father Name'] || row['father_name'] || '').toString(),
                mother_name: (row['Mother Name'] || row['mother_name'] || '').toString(),
                isValid: false,
                errors: []
            };

            const validation = validateStudent(student);
            student.isValid = validation.isValid;
            student.errors = validation.errors;

            return student;
        });

        setParsedData(processed);
        setStep('preview');
    };

    const handleEditCell = (index: number, field: keyof ParsedStudent, value: any) => {
        const newData = [...parsedData];
        let student = { ...newData[index], [field]: value };
        
        // Reset dependent fields if parent field changes
        if (field === 'branch_name') {
            const branch = branches.find(b => b.branch_name === value);
            student.branch_id = branch?.branch_id;
            student.program_name = '';
            student.program_id = undefined;
            student.class_name = '';
            student.class_id = undefined;
        } else if (field === 'program_name') {
            const program = programs.find(p => p.name === value && p.branchId === student.branch_id);
            student.program_id = program?.id;
            student.class_name = '';
            student.class_id = undefined;
        } else if (field === 'class_name') {
            const cls = classes.find(c => c.className === value && c.branchId === student.branch_id && c.programId === student.program_id);
            student.class_id = cls?.class_id;
        }

        // Re-validate
        const validation = validateStudent(student);
        student.isValid = validation.isValid;
        student.errors = validation.errors;
        
        newData[index] = student;
        setParsedData(newData);
    };

    const handleDeleteRow = (index: number) => {
        const newData = [...parsedData];
        newData.splice(index, 1);
        setParsedData(newData);
    };

    const handleImport = async () => {
        setStep('importing');
        setImportProgress({ current: 0, total: parsedData.length });
        
        let successCount = 0;
        let failedCount = 0;

        for (const item of parsedData) {
            try {
                const branchId = item.branch_id || branches.find(b => b.branch_name.toLowerCase() === item.branch_name.toLowerCase())?.branch_id;
                if (!branchId) throw new Error(`Branch "${item.branch_name}" not found`);

                // Create Student
                const studentCode = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
                const newStudent = await addStudent({
                    student_code: studentCode,
                    student_name: item.student_name,
                    first_name: item.first_name,
                    last_name: item.last_name,
                    gender: item.gender,
                    dob: item.dob,
                    pob: item.pob,
                    nationality: item.nationality,
                    branch_id: branchId,
                    address: item.address,
                    phone: item.phone,
                    parent_phone: item.parent_phone,
                    father_name: item.father_name,
                    mother_name: item.mother_name,
                    status: 'Active',
                    admission_date: new Date().toISOString().split('T')[0],
                    age: calculateAge(item.dob)
                }) as any;

                // Handle Enrollment if Program and Class are specified
                if (item.program_id && item.class_id) {
                    const program = programs.find(p => p.id === item.program_id);
                    const activeTerm = terms.find(t => t.status === 'Active' && t.branch_id === branchId) || terms[0];

                    if (activeTerm) {
                        await addEnrollment({
                            student_id: newStudent.id,
                            class_id: item.class_id,
                            term_id: activeTerm.term_id,
                            term: activeTerm.term_name,
                            total_amount: program?.price || 0,
                            discount: 0,
                            paid_amount: 0,
                            payment_status: 'Unpaid',
                            payment_type: 'Cash',
                            enrollment_status: 'Active',
                            start_session: 1,
                            enrolled_at: new Date().toISOString()
                        });
                    }
                }

                successCount++;
            } catch (err) {
                console.error("Import failed for student:", item.student_name, err);
                failedCount++;
            }
            setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }

        setResults({ success: successCount, failed: failedCount });
        setStep('summary');
        onSuccess();
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 0;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const downloadTemplate = () => {
        const template = [
            {
                'Name': 'John Doe',
                'Gender': 'Male',
                'DOB': '2015-05-15',
                'POB': 'Phnom Penh',
                'Branch': branches[0]?.branch_name || 'Main Branch',
                'Program': programs[0]?.name || 'English for Kids',
                'Class': classes.find(c => c.branchId === branches[0]?.branch_id)?.className || 'Room 101',
                'Phone': '012345678',
                'Parent Phone': '098765432',
                'Nationality': 'Cambodian',
                'Address': 'Phnom Penh',
                'Father Name': 'Doe Senior',
                'Mother Name': 'Jane Doe'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, "student_import_template.xlsx");
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md p-2 sm:p-6 lg:p-10"
            onClick={onClose}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`bg-white/95 backdrop-blur-2xl rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${step === 'preview' ? 'w-[98%] max-w-[90rem]' : 'w-full max-w-xl'} border border-white flex flex-col h-[90vh]`}
            >
                {/* Custom Animations via CSS in JS */}
                <style jsx>{`
                    @keyframes custom-pulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                    }
                    @keyframes float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-8px); }
                    }
                    .animate-float { animation: float 3s ease-in-out infinite; }
                    .animate-custom-pulse { animation: custom-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                `}</style>

                {/* Header - Slimmer */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/30 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-custom-pulse">
                            <Upload size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-none">Import Students</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Excel/CSV Integration</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-rose-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area - Scrollable */}
                <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                    {step === 'upload' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {!selectedFile ? (
                                        <div className="space-y-6">
                                            <p className="text-sm font-bold text-slate-600">
                                                Upload your .CSV file or <button onClick={downloadTemplate} className="text-blue-500 hover:underline">download the CSV file</button> to see the format the data must be in.
                                            </p>

                                            <div 
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e); }}
                                                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-4 bg-slate-50/50 ${
                                                    isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                                }`}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    accept=".xlsx,.xls,.csv"
                                                    onChange={handleFileUpload} 
                                                />
                                                
                                                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-400 mb-2 pointer-events-none select-none">
                                                    <Folder size={32} fill="currentColor" className="text-blue-200" />
                                                    <div className="absolute">
                                                        <FileText size={16} className="text-blue-500 translate-y-1" />
                                                    </div>
                                                </div>

                                                <h3 className="text-base font-bold text-slate-700">Drag your CSV file here, or...</h3>
                                                
                                                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded px-3 py-1.5 shadow-sm">
                                                    <span className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded">Choose File</span>
                                                    <span className="text-xs text-slate-400 font-medium">No file chosen</span>
                                                </div>
                                            </div>


                                        </div>
                                    ) : (
                                        <div className="space-y-10 animate-in zoom-in-95 duration-500">
                                            {/* Ready to Process / Uploading Title */}
                                            <div className="text-center">
                                                <h3 className="text-4xl font-black text-slate-900 tracking-tighter animate-pulse uppercase">
                                                    {uploadProgress < 100 ? 'Uploading...' : 'File Ready'}
                                                </h3>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Analyzing structure</p>
                                            </div>

                                            {/* Styled File Card (Image2 style, compact at bottom) */}
                                            <div className="bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] p-6 flex items-center justify-between shadow-2xl shadow-indigo-200/20 border border-indigo-400/10">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-black text-white truncate max-w-[200px]">{selectedFile.name}</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-10 h-10 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all shadow-sm"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => { setSelectedFile(null); setUploadProgress(0); }}
                                                        className="w-10 h-10 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-rose-400 transition-all shadow-sm"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Linear Progress Bar */}
                                            {uploadProgress < 100 && (
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden relative">
                                                    <div 
                                                        className="absolute inset-y-0 left-0 bg-indigo-600 transition-all duration-300 ease-out rounded-full"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between px-2">
                                <div className="max-w-[60%]">
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                                        Data Preview <span className="text-indigo-600 ml-1">({parsedData.length} records)</span>
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">Verify and edit information</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-center px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
                                        <span className="text-sm font-black leading-none">{parsedData.filter(d => d.isValid).length}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5">Valid</span>
                                    </div>
                                    <div className="flex flex-col items-center px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shadow-sm">
                                        <span className="text-sm font-black leading-none">{parsedData.filter(d => !d.isValid).length}</span>
                                        <span className="text-[8px] font-bold uppercase tracking-widest mt-0.5">Errors</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-50/30 rounded-2xl border border-amber-100/50 flex items-center gap-3 shadow-sm">
                                <Edit2 size={16} className="text-amber-600 shrink-0" />
                                <p className="text-[11px] font-bold text-amber-700/80 leading-snug">
                                    Click any cell highlighted in pink to fix validation errors. 
                                    Branch and Program names must match your setup.
                                </p>
                            </div>

                            <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)] bg-white">
                                <div className="overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-200">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Name</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Gender</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">DOB</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Branch</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Program</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Class</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Phone</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {parsedData.map((student, idx) => (
                                                <tr key={idx} className={`${student.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/30'} transition-all group`}>
                                                    <td className="p-3 min-w-[160px]">
                                                        <div className="flex items-center gap-2">
                                                            {student.isValid ? (
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                            ) : (
                                                                <AlertCircle className="text-rose-500 shrink-0" size={12} />
                                                            )}
                                                            {editingCell?.index === idx && editingCell?.field === 'student_name' ? (
                                                                <input 
                                                                    autoFocus
                                                                    className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-300 rounded px-2 py-1 outline-none"
                                                                    value={student.student_name}
                                                                    onChange={(e) => handleEditCell(idx, 'student_name', e.target.value)}
                                                                    onBlur={() => setEditingCell(null)}
                                                                />
                                                            ) : (
                                                                <div onClick={() => setEditingCell({ index: idx, field: 'student_name' })} className="flex items-center justify-between w-full cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5">
                                                                    <span className="text-xs font-bold text-slate-700">{student.student_name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        <div onClick={() => setEditingCell({ index: idx, field: 'gender' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                            {editingCell?.index === idx && editingCell?.field === 'gender' ? (
                                                                <select className="bg-white border border-indigo-300 rounded outline-none text-xs" value={student.gender} onChange={(e) => handleEditCell(idx, 'gender', e.target.value)} onBlur={() => setEditingCell(null)} autoFocus>
                                                                    <option value="Male">Male</option>
                                                                    <option value="Female">Female</option>
                                                                </select>
                                                            ) : student.gender}
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        {editingCell?.index === idx && editingCell?.field === 'dob' ? (
                                                            <input type="date" className="text-xs bg-white border border-indigo-300 rounded outline-none px-2 py-1" value={student.dob} onChange={(e) => handleEditCell(idx, 'dob', e.target.value)} onBlur={() => setEditingCell(null)} autoFocus />
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'dob' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                                {student.dob || 'YYYY-MM-DD'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3">
                                                        {editingCell?.index === idx && editingCell?.field === 'branch_name' ? (
                                                            <select className="text-xs bg-white border border-indigo-300 rounded outline-none px-2 py-1" value={student.branch_name} onChange={(e) => handleEditCell(idx, 'branch_name', e.target.value)} onBlur={() => setEditingCell(null)} autoFocus>
                                                                <option value="">Select Branch</option>
                                                                {branches.map(b => <option key={b.branch_id} value={b.branch_name}>{b.branch_name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'branch_name' })} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer ${branches.some(b => b.branch_name.toLowerCase() === student.branch_name.toLowerCase()) ? 'bg-slate-100 text-slate-700' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                                                {student.branch_name || 'Select Branch'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3">
                                                        {editingCell?.index === idx && editingCell?.field === 'program_name' ? (
                                                            <select className="text-xs bg-white border border-indigo-300 rounded outline-none px-2 py-1" value={student.program_name} onChange={(e) => handleEditCell(idx, 'program_name', e.target.value)} onBlur={() => setEditingCell(null)} autoFocus>
                                                                <option value="">Select Program</option>
                                                                {programs.filter(p => !student.branch_id || p.branchId === student.branch_id).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'program_name' })} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer ${programs.some(p => p.name.toLowerCase() === (student.program_name || '').toLowerCase() && (!student.branch_id || p.branchId === student.branch_id)) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                                                                {student.program_name || 'Optional'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3">
                                                        {editingCell?.index === idx && editingCell?.field === 'class_name' ? (
                                                            <select className="text-xs bg-white border border-indigo-300 rounded outline-none px-2 py-1" value={student.class_name} onChange={(e) => handleEditCell(idx, 'class_name', e.target.value)} onBlur={() => setEditingCell(null)} autoFocus>
                                                                <option value="">Select Class</option>
                                                                {classes.filter(c => (!student.branch_id || c.branchId === student.branch_id) && (!student.program_id || c.programId === student.program_id)).map(c => <option key={c.class_id} value={c.className}>{c.className}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'class_name' })} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer ${classes.some(c => c.className.toLowerCase() === (student.class_name || '').toLowerCase() && (!student.branch_id || c.branchId === student.branch_id) && (!student.program_id || c.programId === student.program_id)) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                                                                {student.class_name || 'Optional'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3 text-xs font-semibold text-slate-600">{student.phone || '-'}</td>

                                                    <td className="p-3">
                                                        {!student.isValid ? (
                                                            <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 whitespace-nowrap">{student.errors[0]}</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100 uppercase tracking-tighter">Ready</span>
                                                        )}
                                                    </td>

                                                    <td className="p-3 text-center">
                                                        <button 
                                                            onClick={() => handleDeleteRow(idx)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors mx-auto"
                                                        >
                                                            <Trash2 size={14} />
                                                            <span className="text-[10px] font-black uppercase tracking-wider">Delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="py-6 space-y-8 animate-in fade-in zoom-in-95 duration-500 text-center flex flex-col items-center">
                            <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm animate-custom-pulse">
                                <AlertTriangle size={40} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Ready to fly?</h3>
                                <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Final check before commitment</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full max-w-md p-2">
                                <div className="bg-white rounded-[1.5rem] border-2 border-slate-50 p-6 shadow-lg shadow-slate-100/50 flex flex-col items-center">
                                    <span className="text-3xl font-black text-slate-800">{parsedData.length}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">New Students</span>
                                </div>
                                <div className="bg-indigo-600 rounded-[1.5rem] p-6 shadow-lg shadow-indigo-100 flex flex-col items-center transform scale-105">
                                    <span className="text-3xl font-black text-white">{parsedData.filter(d => d.program_name && d.class_name).length}</span>
                                    <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">Enrollments</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="py-12 text-center space-y-8 flex flex-col items-center">
                            <div className="relative w-36 h-36 mx-auto">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="72" cy="72" r="60" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-50" />
                                    <circle cx="72" cy="72" r="60" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={377} strokeDashoffset={377 * (1 - importProgress.current / importProgress.total)} strokeLinecap="round" className="text-indigo-600 transition-all duration-700 ease-out" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-slate-800 tracking-tighter">{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Syncing</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                                    Committing to Cloud <Loader2 size={20} className="animate-spin text-indigo-600" />
                                </h3>
                                <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Writing student {importProgress.current} of {importProgress.total}</p>
                            </div>
                        </div>
                    )}

                    {step === 'summary' && (
                        <div className="py-8 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col items-center">
                            <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-emerald-100 shadow-xl animate-custom-pulse">
                                <CheckCircle2 size={48} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Mission Done!</h3>
                                <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-[10px]">Import process finalized</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                                <div className="bg-white rounded-[1.5rem] p-6 border-2 border-emerald-50 shadow-lg shadow-emerald-100/30">
                                    <h4 className="text-3xl font-black text-emerald-600 tracking-tighter">{results.success}</h4>
                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-2">Imported</p>
                                </div>
                                <div className="bg-white rounded-[1.5rem] p-6 border-2 border-rose-50 shadow-lg shadow-rose-100/30">
                                    <h4 className="text-3xl font-black text-rose-600 tracking-tighter">{results.failed}</h4>
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-2">Rejected</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Sticky at bottom */}
                <div className="p-4 sm:p-6 border-t border-slate-50 bg-slate-50/50 flex items-center justify-end shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 'upload' && (
                            <>
                                <button onClick={onClose} className="px-8 py-3 text-slate-400 font-bold text-sm hover:text-slate-600 tracking-tight transition-colors">
                                    Cancel
                                </button>
                                {selectedFile && uploadProgress >= 100 && (
                                    <button 
                                        onClick={() => setStep('preview')}
                                        className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                                    >
                                        Submit
                                    </button>
                                )}
                            </>
                        )}
                        {step === 'preview' && (
                            <button onClick={() => setStep('confirm')} disabled={parsedData.some(d => !d.isValid)} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm active:scale-95">
                                <span>Continue</span> <CheckCircle2 size={16} />
                            </button>
                        )}
                        {step === 'confirm' && (
                            <button onClick={handleImport} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group">
                                <Check size={18} /> Confirm & Import
                            </button>
                        )}
                        {step === 'summary' && (
                            <button onClick={onClose} className="px-12 py-3 bg-slate-900 text-white rounded-2xl font-black text-base hover:bg-black shadow-xl transition-all active:scale-95">
                                Finish
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
