"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  UserPlus, 
  Upload, 
  ChevronLeft, 
  ChevronDown,
  Loader2, 
  Save, 
  User 
} from "lucide-react";
import { branchService } from "@/services/branchService";
import { updateStudent, uploadImage, getStudentById, deactivateStudentEnrollments } from "@/lib/services/schoolService";
import { Branch, Student } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COUNTRIES } from "@/lib/constants";

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  
  // Form State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const unsub = branchService.subscribe(setBranches);
    const fetchStudent = async () => {
        try {
            // We can use the service or direct firestore
            const docRef = doc(db, "students", studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = { student_id: docSnap.id, ...docSnap.data() } as Student;
                setStudent(data);
                if (data.image_url) {
                    setImagePreview(data.image_url);
                }
            } else {
                alert("Student not found");
                router.push('/admin/students');
            }
        } catch (error) {
            console.error("Error fetching student:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchStudent();
    return () => unsub();
  }, [studentId, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (!student) return;
      setSubmitting(true);

      try {
          const formData = new FormData(e.currentTarget);
          
          let imageUrl = student.image_url;
          if (imageFile) {
              imageUrl = await uploadImage(imageFile, `students/${Date.now()}_${imageFile.name}`);
          }

          const studentData: Partial<Student> = {
              first_name: formData.get("first_name") as string,
              last_name: formData.get("last_name") as string,
              student_name: `${formData.get("first_name")} ${formData.get("last_name")}`.trim(),
              // student_code is usually not editable, but we can allow it if needed. Let's keep it read-only or editable? usually editable.
              student_code: formData.get("student_code") as string, 
              age: Number(formData.get("age")),
              gender: formData.get("gender") as any,
              dob: formData.get("dob") as string,
              pob: formData.get("pob") as string,
              nationality: formData.get("nationality") as string,
              branch_id: formData.get("branch_id") as string,
              address: formData.get("address") as string,
              phone: formData.get("phone") as string,
              email: formData.get("email") as string,
              
              // Parent Info
              parent_phone: formData.get("parent_phone") as string,
              mother_name: formData.get("mother_name") as string,
              father_name: formData.get("father_name") as string,
              
              status: formData.get("status") as any,
              // admission_date usually fixed, but editable
              admission_date: formData.get("admission_date") as string,
              image_url: imageUrl,

              // NOTE: Insurance info is NOT updated here as requested
          };

          await updateStudent(studentId, studentData);

          // If status changed to Inactive or Hold, deactivate all enrollments
          const newStatus = formData.get("status") as any;
          if ((newStatus === "Inactive" || newStatus === "Hold") && student.status === "Active") {
              await deactivateStudentEnrollments(studentId, newStatus);
          }

          router.push('/admin/students?action=updated');
          
      } catch (error) {
          console.error("Error updating student:", error);
          alert("Failed to update student");
      } finally {
          setSubmitting(false);
      }
  }

  if (loading) return (
      <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin text-indigo-500" size={48} />
      </div>
  );

  if (!student) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-800">Edit Student</h1>
                <p className="text-slate-500 text-sm font-medium">Update student information</p>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            
            <div className="space-y-8">
                
                {/* Personal Information */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-8">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <User size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Student Information</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        {/* Photo - 4 Cols */}
                        <div className="md:col-span-4 flex flex-col items-center">
                            <div className="relative group w-full max-w-[200px]">
                                <div className="aspect-square rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-400 group-hover:bg-indigo-50/30 shadow-sm">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Upload className="text-slate-300 group-hover:text-indigo-400" size={32} />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                </div>
                                <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Upload Photo</p>
                            </div>
                        </div>

                        {/* Fields - 8 Cols */}
                        <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5 content-start">
                             <Select label="Campus Branch" name="branch_id" defaultValue={student.branch_id} required>
                                <option value="">Select Branch</option>
                                {branches.map(b => (
                                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                ))}
                            </Select>
                            
                            <Select label="Status" name="status" defaultValue={student.status} required>
                                <option value="Active">Active</option>
                                <option value="Hold">Hold</option>
                                <option value="Inactive">Inactive</option>
                            </Select>

                            <Input label="First Name" name="first_name" defaultValue={student.first_name} required />
                            <Input label="Last Name" name="last_name" defaultValue={student.last_name} required />
                            
                            <Input label="Student Code" name="student_code" defaultValue={student.student_code} required />
                            <Select label="Gender" name="gender" defaultValue={student.gender} required>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </Select>

                            <Input label="Date of Birth" name="dob" type="date" defaultValue={student.dob} required />
                            <Input label="Place of Birth" name="pob" defaultValue={student.pob} />
                            
                            <Select label="Nationality" name="nationality" defaultValue={student.nationality} required>
                                <option value="">Select Nationality</option>
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                                ))}
                            </Select>

                            <Input label="Admission Date" name="admission_date" type="date" defaultValue={student.admission_date} required />
                            <Input label="Phone Number" name="phone" defaultValue={student.phone} />
                            <Input label="Email Address" name="email" type="email" defaultValue={student.email} />
                            
                            <div className="md:col-span-2">
                                <Input label="Address" name="address" defaultValue={student.address} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                    type="submit" 
                    disabled={submitting}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : <><Save size={20} /> <span>Update Student Profile</span></>}
                    </button>
                </div>

            </div>

        </form>
    </div>
  );
}

function Input({ label, name, type = "text", required, placeholder, defaultValue }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label} {required && <span className="text-rose-500">*</span>}</label>
            <input 
                name={name} 
                type={type} 
                required={required} 
                placeholder={placeholder}
                defaultValue={defaultValue}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300"
            />
        </div>
    )
}

function Select({ label, name, required, children, defaultValue }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label} {required && <span className="text-rose-500">*</span>}</label>
            <div className="relative">
                <select 
                    name={name} 
                    required={required} 
                    defaultValue={defaultValue}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 appearance-none cursor-pointer"
                >
                    {children}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                </div>
            </div>
        </div>
    )
}
