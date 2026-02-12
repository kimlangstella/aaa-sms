"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, User, Calendar, Phone, Mail, MapPin, Users, BookOpen, DollarSign, CheckCircle2, Clock, Pencil, ShieldCheck, Loader2 } from "lucide-react";
import { Student, Enrollment, Branch, Class, Program } from "@/lib/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { subscribeToClasses } from "@/lib/services/schoolService";
import { termService } from "@/services/termService";
import { Term } from "@/lib/types";
import { NewEnrollmentModal } from "@/components/modals/NewEnrollmentModal";

export default function StudentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const studentId = params.id as string;

    const [student, setStudent] = useState<Student | null>(null);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"profile" | "enrollments" | "attendance" | "payments">("profile");
    const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);

    useEffect(() => {
        const unsubBranches = branchService.subscribe(setBranches);
        const unsubPrograms = programService.subscribe(setPrograms);
        const unsubClasses = subscribeToClasses(setClasses);
        const unsubTerms = termService.subscribe(setTerms);
        return () => {
            unsubBranches();
            unsubPrograms();
            unsubClasses();
            unsubTerms();
        };
    }, []);

    useEffect(() => {
        const fetchStudentData = async () => {
            try {
                // Fetch student
                const studentDoc = await getDoc(doc(db, "students", studentId));
                if (studentDoc.exists()) {
                    setStudent({ student_id: studentDoc.id, ...studentDoc.data() } as Student);
                }

                // Fetch enrollments
                const enrollmentsQuery = query(
                    collection(db, "enrollments"),
                    where("student_id", "==", studentId)
                );
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const enrollmentsData = enrollmentsSnapshot.docs.map(doc => ({
                    enrollment_id: doc.id,
                    ...doc.data()
                } as Enrollment));
                setEnrollments(enrollmentsData);

                setLoading(false);
            } catch (error) {
                console.error("Error fetching student data:", error);
                setLoading(false);
            }
        };

        if (studentId) {
            fetchStudentData();
        }
    }, [studentId]);

    const getBranchName = (branchId: string) => {
        return branches.find(b => b.branch_id === branchId)?.branch_name || "Unknown";
    };

    const getClassName = (classId: string) => {
        return classes.find(c => c.class_id === classId)?.className || "Unknown Class";
    };

    const getProgramName = (classId: string) => {
        const cls = classes.find(c => c.class_id === classId);
        if (!cls) return "Unknown Program";
        const program = programs.find(p => p.id === cls.programId);
        return program?.name || "Unknown Program";
    };

    const getTermName = (enrollment: Enrollment) => {
        // Prefer term_id lookup
        if (enrollment.term_id) {
            const term = terms.find(t => t.term_id === enrollment.term_id);
            if (term) return term.term_name;
        }
        // Fallback to legacy string
        return enrollment.term || "Unknown Term";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="max-w-6xl mx-auto p-8 text-center">
                <p className="text-slate-500">Student not found</p>
                <button
                    onClick={() => router.push("/admin/students")}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
                >
                    Back to Students
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between glass p-3 px-5 rounded-3xl shadow-sm">
                <button
                    onClick={() => router.push("/admin/students")}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all font-bold text-sm"
                >
                    <ArrowLeft size={16} />
                    <span>Back to Students</span>
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push("/admin/students")}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <Pencil size={16} />
                        <span>Edit Student</span>
                    </button>
                </div>
            </div>

            {/* STUDENT PROFILE CARD */}
            <div className="glass-panel p-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-lg">
                            {student.image_url ? (
                                <img src={student.image_url} alt={student.student_name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="text-slate-300" size={48} />
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-4">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{student.student_name}</h1>
                            <p className="text-sm font-bold text-slate-400">REF: {student.student_code}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-bold border ${
                                student.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' :
                                student.status === 'Hold' ? 'bg-amber-50 text-amber-600 border-amber-100/50' :
                                'bg-slate-50 text-slate-600 border-slate-100/50'
                            }`}>
                                {student.status}
                            </span>
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-bold border ${
                                student.gender === 'Female' ? 'bg-pink-50 text-pink-600 border-pink-100/50' : 'bg-blue-50 text-blue-600 border-blue-100/50'
                            }`}>
                                {student.gender}
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-500">
                                {getBranchName(student.branch_id)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <InfoItem icon={<Calendar size={14} />} label="Date of Birth" value={student.dob} />
                            <InfoItem icon={<MapPin size={14} />} label="Nationality" value={student.nationality} />
                            <InfoItem icon={<Phone size={14} />} label="Phone" value={student.phone} />
                            <InfoItem icon={<Mail size={14} />} label="Email" value={student.email || "N/A"} />
                            <InfoItem icon={<MapPin size={14} />} label="Address" value={student.address} />
                            <InfoItem icon={<Phone size={14} />} label="Parent Contact" value={student.parent_phone} />
                        </div>

                        {student.mother_name && (
                            <div className="pt-4 border-t border-slate-100">
                                <InfoItem icon={<Users size={14} />} label="Mother's Name" value={student.mother_name} />
                            </div>
                        )}

                        {student.insurance_info && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheck size={16} className="text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-700">Insurance Information</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 font-medium">Provider:</span>
                                        <span className="ml-2 text-slate-700 font-bold">{student.insurance_info.provider}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium">Policy:</span>
                                        <span className="ml-2 text-slate-700 font-bold">{student.insurance_info.policy_number}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium">Coverage:</span>
                                        <span className="ml-2 text-slate-700 font-bold">${student.insurance_info.coverage_amount?.toLocaleString() || '0'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium">Valid Until:</span>
                                        <span className="ml-2 text-slate-700 font-bold">{student.insurance_info.end_date}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="glass-panel overflow-hidden">
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<User size={14} />} label="Profile" />
                    <TabButton active={activeTab === "enrollments"} onClick={() => setActiveTab("enrollments")} icon={<BookOpen size={14} />} label="Enrollments" />
                    <TabButton active={activeTab === "attendance"} onClick={() => setActiveTab("attendance")} icon={<CheckCircle2 size={14} />} label="Attendance" />
                    <TabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")} icon={<DollarSign size={14} />} label="Payments" />
                </div>

                <div className="p-8">
                    {activeTab === "profile" && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800">Additional Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoItem label="Place of Birth" value={student.pob} />
                                <InfoItem label="Age" value={`${student.age} years`} />
                                <InfoItem label="Admission Date" value={student.admission_date} />
                                <InfoItem label="Created At" value={new Date(student.created_at).toLocaleDateString()} />
                            </div>
                        </div>
                    )}

                    {activeTab === "enrollments" && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black text-slate-800">Enrollment History</h3>
                                <button 
                                    onClick={() => setShowEnrollmentModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                                >
                                    <BookOpen size={14} />
                                    <span>New Enrollment</span>
                                </button>
                            </div>

                            {/* Modal */}
                            {showEnrollmentModal && student && (
                                <NewEnrollmentModal 
                                    isOpen={showEnrollmentModal} 
                                    onClose={() => setShowEnrollmentModal(false)}
                                    student={student}
                                    onSuccess={() => {
                                        // Refresh data
                                        window.location.reload(); 
                                    }}
                                />
                            )}

                            {enrollments.length === 0 ? (
                                <p className="text-slate-400 text-sm py-8 text-center">No enrollments found</p>
                            ) : (
                                <div className="space-y-3">
                                    {enrollments.map(enrollment => (
                                        <div key={enrollment.enrollment_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{getProgramName(enrollment.class_id)}</p>
                                                    <p className="text-xs text-indigo-600 font-semibold">{getClassName(enrollment.class_id)}</p>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{getTermName(enrollment)}</span>
                                                        <span>•</span>
                                                        <span>Start Session: {enrollment.start_session}</span>
                                                    </div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-bold border ${
                                                    enrollment.payment_status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' :
                                                    'bg-rose-50 text-rose-600 border-rose-100/50'
                                                }`}>
                                                    {enrollment.payment_status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 text-xs">
                                                <div>
                                                    <span className="text-slate-400">Total:</span>
                                                    <span className="ml-2 font-bold text-slate-700">${enrollment.total_amount || (function(){
                                                        const cls = classes.find(c => c.class_id === enrollment.class_id);
                                                        const prog = cls ? programs.find(p => p.id === cls.programId) : null;
                                                        return prog ? prog.price : 0;
                                                    })()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">Discount:</span>
                                                    <span className="ml-2 font-bold text-slate-700">${enrollment.discount}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">Paid:</span>
                                                    <span className="ml-2 font-bold text-emerald-600">${enrollment.paid_amount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "attendance" && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800">Attendance Records</h3>
                            <p className="text-slate-400 text-sm py-8 text-center">Attendance tracking coming soon</p>
                        </div>
                    )}

                    {activeTab === "payments" && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800">Payment History</h3>
                            {enrollments.length === 0 ? (
                                <p className="text-slate-400 text-sm py-8 text-center">No payment records found</p>
                            ) : (
                                <div className="space-y-3">
                                    {enrollments.map(enrollment => (
                                        <div key={enrollment.enrollment_id} className="p-5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="font-bold text-slate-900">{getProgramName(enrollment.class_id)}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-xs text-slate-500">{getClassName(enrollment.class_id)}</p>
                                                        {enrollment.term && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                {enrollment.term}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${
                                                    enrollment.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {enrollment.payment_status}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-xs bg-slate-50 p-3 rounded-lg">
                                                <div>
                                                    <span className="text-slate-400 block">Total Amount</span>
                                                    <span className="font-bold text-slate-800 text-sm">${enrollment.total_amount || (function(){
                                                        const cls = classes.find(c => c.class_id === enrollment.class_id);
                                                        const prog = cls ? programs.find(p => p.id === cls.programId) : null;
                                                        return prog ? prog.price : 0;
                                                    })()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block">Discount</span>
                                                    <span className="font-bold text-indigo-600 text-sm">${enrollment.discount || 0}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block">Paid</span>
                                                    <span className="font-bold text-emerald-600 text-sm">${enrollment.paid_amount}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block">Balance</span>
                                                    <span className="font-bold text-rose-600 text-sm">${(Number(enrollment.total_amount || (function(){
                                                        const cls = classes.find(c => c.class_id === enrollment.class_id);
                                                        const prog = cls ? programs.find(p => p.id === cls.programId) : null;
                                                        return prog ? prog.price : 0;
                                                    })()) - Number(enrollment.discount || 0) - Number(enrollment.paid_amount)).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            {enrollment.payment_due_date && (
                                                <div className="mt-3 text-xs text-slate-500">
                                                    <Calendar size={12} className="inline mr-1" />
                                                    Due Date: <span className="font-semibold">{enrollment.payment_due_date}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2">
            {icon && <div className="text-slate-400 mt-0.5">{icon}</div>}
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                <p className="text-sm font-bold text-slate-700">{value}</p>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-4 font-bold text-xs transition-all border-b-2 ${
                active
                    ? "border-indigo-600 text-indigo-600 bg-white"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
