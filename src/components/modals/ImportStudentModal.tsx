"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Search, Download, Edit2, Check, AlertTriangle, Trash2, RotateCcw, Folder } from "lucide-react";
import * as XLSX from "xlsx";
import { Student, Branch, Gender, StudentStatus, PaymentStatus, Program, Class, Term } from "@/lib/types";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { addStudent, getClasses, addEnrollment, getStudents } from "@/lib/services/schoolService";

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
    program_ids?: string[];
    class_ids?: string[];
    address: string;
    status: StudentStatus;
    payment_status: PaymentStatus;
    payment_expired: string;
    father_name: string;
    mother_name: string;
    admission_date: string;
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
    const [allStudents, setAllStudents] = useState<Student[]>([]);
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
            getStudents().then(setAllStudents);
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
                    
                    // Read as array of arrays to find header row
                    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                    
                    // Find the header row (searching for "Name" or "student_name")
                    let headerIndex = -1;
                    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                        const row = rawData[i];
                        if (row.some(cell => {
                            const val = String(cell || '').toLowerCase().trim();
                            return val === 'name' || val === 'student_name' || val === 'full name' || val === 'student name';
                        })) {
                            headerIndex = i;
                            break;
                        }
                    }

                    if (headerIndex !== -1) {
                        // Extract headers and data
                        const headers = rawData[headerIndex].map(h => String(h || '').trim());
                        const dataRows = rawData.slice(headerIndex + 1);
                        
                        // Map rows to objects
                        const data = dataRows.map(row => {
                            const obj: any = {};
                            headers.forEach((h, idx) => {
                                if (h) obj[h] = row[idx];
                            });
                            return obj;
                        }).filter(obj => Object.values(obj).some(v => v !== null && v !== undefined && v !== ''));

                        processImportData(data);
                    } else {
                        // Fallback to default behavior if header not found
                        const data = XLSX.utils.sheet_to_json(ws);
                        processImportData(data);
                    }
                };
                reader.readAsBinaryString(file!);
            }
        }, 150);
    };

    const validateStudent = (student: Partial<ParsedStudent>) => {
        const errors: string[] = [];
        if (!student.student_name && (!student.first_name || !student.last_name)) errors.push('Name is required');
        if (!student.gender) errors.push('Gender is required');
        if (!student.dob) errors.push('DOB is required');
        if (!student.branch_name) errors.push('Branch is required');
        if (!student.program_name) errors.push('Program is required');
        if (!student.class_name) errors.push('Class is required');
        if (student.phone) {
            const phone = student.phone.toString().trim();
            if (phone.length < 8) errors.push('Phone must be at least 8 digits');
        }
        if (!student.parent_phone) errors.push('Parent Phone is required');

        // --- Duplicate Check ---
        const nameMatch = (student.student_name || `${student.first_name} ${student.last_name}`).trim();
        const isDuplicate = allStudents.some(s => 
            s.student_name.toLowerCase() === nameMatch.toLowerCase()
        );

        if (isDuplicate) {
            errors.push('Student already exists (Duplicate)');
        }
        
        // Check if branch exists
        const branch = branches.find(b => b.branch_name.toLowerCase() === student.branch_name?.toLowerCase());
        if (student.branch_name && !branch) {
            errors.push(`Branch "${student.branch_name}" not found`);
        } else if (branch) {
            student.branch_id = branch.branch_id;
        }

        // Program Validation
        if (student.program_name) {
            const programNames = student.program_name.split(',').map(s => s.trim()).filter(Boolean);
            const classNames = student.class_name ? student.class_name.split(',').map(s => s.trim()).filter(Boolean) : [];
            
            student.program_ids = [];
            student.class_ids = [];

            programNames.forEach((progName, index) => {
                const program = programs.find(p => p.name.toLowerCase() === progName.toLowerCase() && (!branch || p.branchId === branch.branch_id));
                if (!program) {
                    errors.push(`Program "${progName}" not found in this branch`);
                } else {
                    student.program_ids!.push(program.id);
                    // Match single program logic backward compatability
                    if(index === 0) student.program_id = program.id;
                    
                    // Class Validation within Branch & Program
                    const clsName = classNames[index]; // Assume 1:1 mapping of program to class by index if provided
                    if (clsName) {
                        const cls = classes.find(c => {
                            const normalizedInput = clsName.toLowerCase().replace(/[\s\-_]+/g, '');
                            const normalizedClassName = c.className.toLowerCase().replace(/[\s\-_]+/g, '');
                            const isNameMatch = normalizedInput.includes(normalizedClassName) || normalizedClassName.includes(normalizedInput);
                            
                            const scheduleStr = `${c.days?.map(d => d.slice(0, 3)).join(', ')}(${c.startTime}-${c.endTime})`.toLowerCase().replace(/[\s\-_]+/g, '');
                            const isScheduleMatch = normalizedInput.includes(scheduleStr);
                            
                            return (isNameMatch || isScheduleMatch) &&
                                c.branchId === branch?.branch_id &&
                                c.programId === program.id;
                        });
                        if (!cls) {
                            errors.push(`Class "${clsName}" not found for program "${progName}"`);
                        } else {
                            student.class_ids!.push(cls.class_id);
                            if(index === 0) {
                                student.class_id = cls.class_id;
                                // Update name to ONLY the schedule string for user visibility
                                const sched = `${cls.days?.map(d => d.slice(0, 3)).join(', ')}(${cls.startTime}-${cls.endTime})`.trim();
                                student.class_name = sched || cls.className;
                            }
                        }
                    }
                }
            });
            
            // If arrays got out of sync or lengths mismatch
            if (classNames.length > 0 && classNames.length !== programNames.length) {
                errors.push(`Mismatch between number of programs (${programNames.length}) and classes (${classNames.length})`);
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
                program_ids: [],
                class_ids: [],
                address: (row['Address'] || row['address'] || '').toString(),
                status: (()=>{
                    const s = (row['Status'] || row['status'] || 'Active').toString().trim();
                    if (s.toLowerCase().startsWith('in')) return 'Inactive' as StudentStatus;
                    if (s.toLowerCase().startsWith('ho')) return 'Hold' as StudentStatus;
                    return 'Active' as StudentStatus;
                })(),
                payment_status: (()=>{
                    const s = (row['Payment Status'] || row['payment_status'] || row['Payment'] || row['payment'] || 'Unpaid').toString().trim();
                    if (s.toLowerCase().startsWith('pa')) return 'Paid' as PaymentStatus;
                    return 'Unpaid' as PaymentStatus;
                })(),
                payment_expired: (row['Due Date'] || row['due_date'] || row['payment_expired'] || '').toString(),
                father_name: (row['Father Name'] || row['father_name'] || '').toString(),
                mother_name: (row['Mother Name'] || row['mother_name'] || '').toString(),
                admission_date: (row['Admission Date'] || row['admission_date'] || row['Admission'] || new Date().toISOString().split('T')[0]).toString(),
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
            student.program_id = undefined;
            student.program_ids = [];
            student.class_name = '';
            student.class_id = undefined;
            student.class_ids = [];
        } else if (field === 'class_name') {
            student.class_id = undefined;
            student.class_ids = [];
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
                    status: item.status || 'Active',
                    admission_date: item.admission_date || new Date().toISOString().split('T')[0],
                    age: calculateAge(item.dob)
                }) as any;

                // Handle Enrollment if Program and Class are specified
                if (item.program_ids && item.program_ids.length > 0 && item.class_ids && item.class_ids.length === item.program_ids.length) {
                    const activeTerm = terms.find(t => t.status === 'Active' && t.branch_id === branchId) || terms[0];

                    if (activeTerm) {
                        for (let i = 0; i < item.program_ids.length; i++) {
                            const progId = item.program_ids[i];
                            const clsId = item.class_ids[i];
                            const program = programs.find(p => p.id === progId);
                            
                            await addEnrollment({
                                student_id: newStudent.id,
                                class_id: clsId,
                                branchId: branchId, // Add for easier lookup
                                programId: progId, // Add for easier lookup
                                term_id: activeTerm.term_id,
                                term: activeTerm.term_name,
                                total_amount: program?.price || 0,
                                discount: 0,
                                paid_amount: item.payment_status === 'Paid' ? (program?.price || 0) : 0,
                                payment_status: item.payment_status || 'Unpaid',
                                payment_type: 'Cash',
                                payment_due_date: item.payment_expired || activeTerm.end_date,
                                payment_expired: item.payment_expired || activeTerm.end_date,
                                enrollment_status: 'Active',
                                start_session: 1,
                                enrolled_at: new Date().toISOString()
                            });
                        }
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

    const downloadTemplate = async () => {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students Import');

        // 1. School Branding Row
        const titleRow = worksheet.addRow(['Authentic Advanced Academy (AAA) — Student Import Template']);
        worksheet.mergeCells('A1:P1');
        titleRow.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF4F46E5' } };
        titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        titleRow.height = 36;

        // 2. Instruction row
        const instrRow = worksheet.addRow(['Fill in your data below. Required columns are marked with ★. The first row with example data is for reference — please delete it before importing.']);
        worksheet.mergeCells('A2:P2');
        instrRow.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
        instrRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        instrRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        instrRow.height = 22;

        // 3. Spacer
        worksheet.addRow([]);

        // 4. Column Headers (required starred, optional light)
        const colDefs = [
            { label: '★ Name',          key: 'Name',           required: true,  width: 26 },
            { label: '★ Gender',        key: 'Gender',         required: true,  width: 12 },
            { label: '★ DOB',           key: 'DOB',            required: true,  width: 14 },
            { label: 'POB',             key: 'POB',            required: false, width: 18 },
            { label: 'Nationality',     key: 'Nationality',    required: false, width: 16 },
            { label: '★ Phone',         key: 'Phone',          required: true,  width: 16 },
            { label: '★ Parent Phone',  key: 'Parent Phone',   required: true,  width: 16 },
            { label: '★ Branch',        key: 'Branch',         required: true,  width: 20 },
            { label: 'Program',         key: 'Program',        required: false, width: 22 },
            { label: 'Class',           key: 'Class',          required: false, width: 22 },
            { label: 'Status',          key: 'Status',         required: false, width: 14 },
            { label: 'Payment Status',  key: 'Payment Status', required: false, width: 16 },
            { label: 'Due Date',        key: 'Due Date',       required: false, width: 16 },
            { label: 'Admission Date',  key: 'Admission Date', required: false, width: 16 },
            { label: 'Address',         key: 'Address',        required: false, width: 28 },
            { label: 'Father Name',     key: 'Father Name',    required: false, width: 20 },
            { label: 'Mother Name',     key: 'Mother Name',    required: false, width: 20 },
        ];

        const headerRow = worksheet.addRow(colDefs.map(c => c.label));
        headerRow.height = 30;
        headerRow.eachCell((cell, colIdx) => {
            const isRequired = colDefs[colIdx - 1]?.required;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRequired ? 'FF4F46E5' : 'FF818CF8' } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FF4338CA' } } };
        });

        // Set column widths
        colDefs.forEach((col, i) => {
            worksheet.getColumn(i + 1).width = col.width;
        });

        // 5. Sample Data Row
        const branchExample = branches[0]?.branch_name || 'Funmall TK';
        const sampleRow = worksheet.addRow([
            'Seng Meng',
            'Male',
            '2015-05-20',
            'Phnom Penh',
            'Cambodian',
            '012345678',
            '098765432',
            branchExample,
            'Robotic',
            'sat(09:00-10:30)',
            'Active',
            'Paid',
            terms[0]?.end_date || new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0],
            'Street 271, Sangkat Boeung Tumpun, Phnom Penh',
            'Seng Samnang',
            'Keo Sokha'
        ]);
        sampleRow.height = 24;
        sampleRow.eachCell(cell => {
            cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // 6. Instructions Sheet
        const instructionSheet = workbook.addWorksheet('How to Fill');
        const instructions = [
            ['Field',           'Required', 'Format / Notes'],
            ['Name',            'YES',      'Full name of student'],
            ['Gender',          'YES',      'Male / Female'],
            ['DOB',             'YES',      'YYYY-MM-DD (e.g. 2015-05-20)'],
            ['POB',             'NO',       'Place of birth'],
            ['Nationality',     'NO',       'Default: Cambodian'],
            ['Phone',           'YES',      'Student or guardian phone number'],
            ['Parent Phone',    'YES',      "Parent's phone number"],
            ['Branch',         'YES',      'Must exactly match an existing branch name'],
            ['Program',         'NO',       'Must match existing program in the branch. Separate multiple with comma.'],
            ['Class',           'NO',       'Schedule format: sat(09:00-10:30). Separate multiple with comma.'],
            ['Status',          'NO',       'Active / Inactive / Hold (default: Active)'],
            ['Payment Status',  'NO',       'Paid / Unpaid (default: Unpaid)'],
            ['Admission Date',  'NO',       'YYYY-MM-DD format'],
            ['Address',         'NO',       'Full address'],
            ['Father Name',     'NO',       "Father's full name"],
            ['Mother Name',     'NO',       "Mother's full name"],
        ];

        const instrHeaderRow = instructionSheet.addRow(['AAA Import Guide — Field Descriptions']);
        instructionSheet.mergeCells('A1:C1');
        instrHeaderRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF4F46E5' } };
        instrHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        instrHeaderRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        instrHeaderRow.height = 32;
        instructionSheet.addRow([]);

        instructions.forEach((row, rowIdx) => {
            const addedRow = instructionSheet.addRow(row);
            addedRow.height = 22;
            addedRow.eachCell((cell, colIdx) => {
                if (rowIdx === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                    const isEven = rowIdx % 2 === 0;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } };
                    cell.font = {
                        name: 'Calibri', size: 10,
                        color: { argb: colIdx === 2 && row[1] === 'YES' ? 'FF4F46E5' : 'FF334155' },
                        bold: colIdx === 2 && row[1] === 'YES'
                    };
                }
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                cell.alignment = { vertical: 'middle', wrapText: true };
            });
        });
        instructionSheet.getColumn(1).width = 18;
        instructionSheet.getColumn(2).width = 12;
        instructionSheet.getColumn(3).width = 55;

        // 7. Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'AAA_Student_Import_Template.xlsx';
        anchor.click();
        window.URL.revokeObjectURL(url);
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

                                            {/* Styled File Card (Indigo Style) */}
                                            <div className="bg-indigo-600/95 backdrop-blur-xl rounded-[2.5rem] p-6 flex items-center justify-between shadow-2xl shadow-indigo-200/40 border border-white/20">
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
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Due Date</th>
                                                <th className="p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Adm. Date</th>
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
                                                                {classes.filter(c => (!student.branch_id || c.branchId === student.branch_id) && (!student.program_id || c.programId === student.program_id)).map(c => {
                                                                    const sched = `${c.days?.map(d => d.slice(0, 3)).join(', ')}(${c.startTime}-${c.endTime})`.trim();
                                                                    return <option key={c.class_id} value={c.className}>{sched || c.className}</option>;
                                                                })}
                                                            </select>
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'class_name' })} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer ${classes.some(c => {
                                                                const isNameMatch = c.className.toLowerCase() === (student.class_name || '').toLowerCase();
                                                                const scheduleStr = `${c.days?.map(d => d.slice(0, 3)).join(', ')}(${c.startTime}-${c.endTime})`.toLowerCase();
                                                                const isScheduleMatch = scheduleStr === (student.class_name || '').toLowerCase();
                                                                return (isNameMatch || isScheduleMatch) && (!student.branch_id || c.branchId === student.branch_id) && (!student.program_id || c.programId === student.program_id);
                                                            }) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                                                                {student.class_name || 'Optional'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3 text-xs font-semibold text-slate-600">{student.phone || '-'}</td>
                                                    
                                                    <td className="p-3">
                                                        <div onClick={() => setEditingCell({ index: idx, field: 'status' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${student.status === 'Active' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : student.status === 'Hold' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                                                                {student.status}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        <div onClick={() => setEditingCell({ index: idx, field: 'payment_status' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${student.payment_status === 'Paid' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
                                                                {student.payment_status}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="p-3">
                                                        {editingCell?.index === idx && editingCell?.field === 'payment_expired' ? (
                                                            <input 
                                                                type="date" 
                                                                className="text-[10px] font-bold text-slate-800 bg-white border border-indigo-300 rounded px-2 py-1 outline-none" 
                                                                value={student.payment_expired} 
                                                                onChange={(e) => handleEditCell(idx, 'payment_expired', e.target.value)} 
                                                                onBlur={() => setEditingCell(null)} 
                                                                autoFocus 
                                                            />
                                                        ) : (
                                                            <div onClick={() => setEditingCell({ index: idx, field: 'payment_expired' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                                                {student.payment_expired || 'YYYY-MM-DD'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="p-3 text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                                        <div onClick={() => setEditingCell({ index: idx, field: 'admission_date' })} className="cursor-pointer hover:bg-slate-100 rounded px-2 py-0.5">
                                                            {student.admission_date || '-'}
                                                        </div>
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
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Processing</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                                    <Loader2 size={24} className="animate-spin text-indigo-600" />
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
                                <Check size={18} /> Confirm
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
