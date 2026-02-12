"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { 
  UserPlus, 
  Upload, 
  ChevronLeft, 
  ChevronDown,
  Loader2, 
  Save, 
  User,
  CreditCard,
  BookOpen,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Calendar,
  School,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
  Plus,
  X,
  Edit2,
  Trash2,
  Eye,
  Printer
} from "lucide-react";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { 
  addStudent, 
  uploadImage, 
  getClasses, 
  addEnrollment, 
  subscribeToSchoolDetails,
  checkPhoneDuplicate,
  getLastSessionForClass
} from "@/lib/services/schoolService";
import { Branch, Class, PaymentType, School as SchoolType, Term } from "@/lib/types";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COUNTRIES } from "@/lib/constants";

export default function AddStudentPage() {
  const router = useRouter();
  const [school, setSchool] = useState<SchoolType | null>(null);

  useEffect(() => {
    const unsub = subscribeToSchoolDetails(setSchool);
    return () => unsub();
  }, []);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  
  // Step State
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Form Data State
  const [formData, setFormData] = useState({
      // Step 1: Student
      first_name: "",
      last_name: "",
      student_code: "",
      gender: "",
      dob: "",
      pob: "",
      nationality: "Cambodian",
      phone: "",
      email: "",
      address: "",
      
      // Step 1: Parent
      father_name: "",
      mother_name: "",
      parent_phone: "",
      
      // Step 2: Enrollment (Managed by selectedPrograms now)
      branch_id: "",
      status: "Active",
      admission_date: new Date().toISOString().split('T')[0],

      // Step 3: Payment
      payment_type: "Cash" as PaymentType,
      discount: "0",
      paid_amount: "0",
      total_amount: "0",
      payment_due_date: "", // Initialize
  });

  // Multiple Programs State
  const [selectedPrograms, setSelectedPrograms] = useState<any[]>([]);
  const [isAddingProgram, setIsAddingProgram] = useState(false);
  const [editingProgramIndex, setEditingProgramIndex] = useState<number | null>(null);
  
  // Temporary state for the "Add Program" sub-modal
  const [newProgramData, setNewProgramData] = useState({
      program_id: "",
      class_id: "",
      start_session: "1",
      include_next_term: false,
      admission_date: new Date().toISOString().split('T')[0]
  });

  const [terms, setTerms] = useState<Term[]>([]);

  useEffect(() => {
    const unsub = branchService.subscribe(setBranches);
    const unsubTerms = termService.subscribe((fetchedTerms) => {
        setTerms(fetchedTerms);
        // Auto-set Payment Due Date to Active Term's End Date
        const active = fetchedTerms.find(t => t.status === 'Active');
        if (active && active.end_date) {
            setFormData(prev => ({ ...prev, payment_due_date: active.end_date }));
        }
    });
    return () => { unsub(); unsubTerms(); };
  }, []);

  // Auto-fetch Session Start when Class ID changes
  useEffect(() => {
      const fetchSession = async () => {
          if (newProgramData.class_id) {
              const activeTerm = terms.find(t => t.status === 'Active');
              // If we have an active term, try to find the last session
              const lastSession = await getLastSessionForClass(newProgramData.class_id, activeTerm?.term_id);
              
              // If lastSession is 0, start at 1. If 5, start at 6.
              const nextSession = lastSession + 1;
              setNewProgramData(prev => ({ ...prev, start_session: nextSession.toString() }));
          } else {
              setNewProgramData(prev => ({ ...prev, start_session: "1" }));
          }
      };
      fetchSession();
  }, [newProgramData.class_id, terms]);

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Duplicate Check State
  const [duplicateCheck, setDuplicateCheck] = useState<{
      isChecking: boolean;
      exists: boolean;
      message: string;
      type: 'name' | 'phone';
  }>({ isChecking: false, exists: false, message: "", type: 'name' });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const validatePhone = (phone: string) => {
      // Allow 9-10 digits, starting with 0
      // e.g. 012345678 (9) or 0123456789 (10)
      const phoneRegex = /^0\d{8,9}$/; 
      return phoneRegex.test(phone.replace(/\s/g, ''));
  };
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateStudents, setDuplicateStudents] = useState<any[]>([]);
  
  // Step 4 State
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [createdStudent, setCreatedStudent] = useState<any>(null);
  const [createdEnrollments, setCreatedEnrollments] = useState<any[]>([]);
  const invoiceRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: createdStudent ? `Invoice-${createdStudent.student_code}` : 'Invoice',
  });

  // Discount State (Percentage Only)
  const [discountInput, setDiscountInput] = useState("0");


  // Fetch classes and programs when branch changes
  useEffect(() => {
      // Clear selections when branch changes
      setSelectedPrograms([]);
      setPrograms([]);
      
      if (formData.branch_id) {
          // Fetch Programs
          programService.getAll(formData.branch_id).then(setPrograms).catch(console.error);
          // Classes will be fetched when program is selected in sub-modal or we can fetch all for branch
          getClasses(formData.branch_id).then(setClasses).catch(console.error); 
      } else {
          setClasses([]);
          setPrograms([]);
      }
  }, [formData.branch_id]);

  // Update total amount when selectedPrograms changes
  useEffect(() => {
    const total = selectedPrograms.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
    setFormData(prev => ({ 
        ...prev, 
        total_amount: total.toString(),
    }));
  }, [selectedPrograms]);

  // Recalculate Discount Amount when Total or Input (Percentage) changes
  useEffect(() => {
      const total = Number(formData.total_amount) || 0;
      const inputPercent = Number(discountInput) || 0;
      
      // Calculate amount based on percentage
      const calculatedDiscount = total * (inputPercent / 100);

      // Update formData.discount (actual dollar amount), fixed to 2 decimals
      setFormData(prev => ({ ...prev, discount: calculatedDiscount.toFixed(2) }));
  }, [formData.total_amount, discountInput]);

  const [paymentStatusOption, setPaymentStatusOption] = useState<'Paid' | 'Unpaid'>('Unpaid');

  // Auto-update Paid Amount when Total or Discount changes (if Paid)
  useEffect(() => {
      if (paymentStatusOption === 'Paid') {
            const total = Number(formData.total_amount) || 0;
            const discount = Number(formData.discount) || 0;
            const toPay = Math.max(0, total - discount);
            setFormData(prev => ({ ...prev, paid_amount: toPay.toFixed(2) }));
      }
  }, [formData.total_amount, formData.discount, paymentStatusOption]);

  const handlePaymentStatusChange = (status: 'Paid' | 'Unpaid') => {
      setPaymentStatusOption(status);
      if (status === 'Paid') {
          setFormData(prev => ({ ...prev, paid_amount: prev.total_amount }));
      } else if (status === 'Unpaid') {
          setFormData(prev => ({ ...prev, paid_amount: "0" }));
      }
      // Partial leaves it as is (or clears it? Let's leave it)
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let { name, value } = e.target;
      
      // Numeric-only restriction for phone fields
      if (name === 'phone' || name === 'parent_phone') {
          value = value.replace(/\D/g, ''); // Keep only digits
      }

      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Clear error when typing
      if (validationErrors[name]) {
          setValidationErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[name];
              return newErrors;
          });
      }
  };

  const handleAddProgram = () => {
    if (!newProgramData.program_id || !newProgramData.class_id) {
        alert("Please fill in all program details");
        return;
    }

    const program = programs.find(p => p.id === newProgramData.program_id);
    const cls = classes.find(c => c.class_id === newProgramData.class_id);

    if (program && cls) {
        // Calculate Fee
        const startSession = parseInt(newProgramData.start_session) || 1;
        const totalSessions = cls.totalSessions || 11; // Default 11 if not set
        const remainingSessions = Math.max(0, totalSessions - startSession + 1);
        
        // Fee Logic:
        // 1. If program has specific session_fee, use it.
        // 2. Else calculate per-session from total price / total sessions.
        let feePerSession = 0;
        if (program.session_fee) {
            feePerSession = Number(program.session_fee);
        } else {
            feePerSession = Number(program.price) / totalSessions;
        }

        let calculatedPrice = feePerSession * remainingSessions;

        // Add next term if selected
        if (newProgramData.include_next_term) {
             calculatedPrice += Number(program.price);
        }

        if (editingProgramIndex !== null) {
            // Edit existing
            setSelectedPrograms(prev => {
                const newArr = [...prev];
                newArr[editingProgramIndex] = {
                    ...newProgramData,
                    program_name: program.name,
                    class_name: cls.className,
                    total_sessions: totalSessions,
                    price: calculatedPrice.toFixed(2),
                    // Store for re-edit
                    start_session: newProgramData.start_session,
                    include_next_term: newProgramData.include_next_term
                };
                return newArr;
            });
            setEditingProgramIndex(null);
        } else {
            // Add new
            setSelectedPrograms(prev => [...prev, {
                ...newProgramData,
                program_name: program.name,
                class_name: cls.className,
                total_sessions: totalSessions,
                price: calculatedPrice.toFixed(2),
                // Store for re-edit
                start_session: newProgramData.start_session,
                include_next_term: newProgramData.include_next_term
            }]);
        }
        
        // Reset and close
        setNewProgramData({
            program_id: "",
            class_id: "",
            start_session: "1",
            include_next_term: false,
            admission_date: new Date().toISOString().split('T')[0]
        });
        setIsAddingProgram(false);
    }
  };

  const handleEditProgram = (index: number) => {
      const prog = selectedPrograms[index];
      setNewProgramData({
          program_id: prog.program_id,
          class_id: prog.class_id,
          start_session: prog.start_session || "1",
          include_next_term: prog.include_next_term || false,
          admission_date: prog.admission_date || new Date().toISOString().split('T')[0]
      });
      setEditingProgramIndex(index);
      setIsAddingProgram(true);
  };

  const handleRemoveProgram = (index: number) => {
      if (window.confirm("Are you sure you want to remove this program?")) {
        setSelectedPrograms(prev => prev.filter((_, i) => i !== index));
      }
  };

  const validateStep = (step: number) => {
      const errors: { [key: string]: string } = {};

      if (step === 1) {
          if (!formData.first_name) errors.first_name = "First name is required";
          if (!formData.last_name) errors.last_name = "Last name is required";
          if (!formData.gender) errors.gender = "Gender is required";
          if (!formData.dob) errors.dob = "Date of birth is required";
          if (!formData.branch_id) errors.branch_id = "Branch is required";
          if (!formData.nationality) errors.nationality = "Nationality is required";

          // Phone Validation
          if (formData.phone && !validatePhone(formData.phone)) {
               errors.phone = "Invalid format. Use 9-10 digits starting with 0";
          }
          if (formData.parent_phone && !validatePhone(formData.parent_phone)) {
               errors.parent_phone = "Invalid format. Use 9-10 digits starting with 0";
          }

          if (Object.keys(errors).length > 0) {
              setValidationErrors(errors);
              // alert("Please fix the errors before proceeding.");
              return false;
          }
      }
      if (step === 2) {
          if (selectedPrograms.length === 0) {
              alert("Please add at least one program.");
              return false;
          }
      }
      if (step === 3) {
           if (!formData.total_amount || !formData.paid_amount || !formData.payment_type) {
               alert("Please fill in payment details.");
               return false;
           }
      }
      return true;
  };

  const nextStep = async () => {
      if (!validateStep(currentStep)) return;

      // Step 1: Check for duplicates before proceeding to Enrollment
      if (currentStep === 1) {
          const studentName = `${formData.first_name} ${formData.last_name}`.trim();
          
          try {
              // 1. Check Name Duplicate
              const nameQuery = query(collection(db, "students"), where("student_name", "==", studentName));
              const nameSnap = await getDocs(nameQuery);
              
              if (!nameSnap.empty) {
                  const duplicates = nameSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                  setDuplicateStudents(duplicates);
                  setDuplicateCheck(prev => ({ ...prev, type: 'name' }));
                  setShowDuplicateModal(true);
                  return;
              }

              // 2. Check Phone Duplicate (Student Phone)
              if (formData.phone) {
                  const phoneDupes = await checkPhoneDuplicate(formData.phone);
                  if (phoneDupes.length > 0) {
                      setDuplicateStudents(phoneDupes);
                      setDuplicateCheck(prev => ({ ...prev, type: 'phone', message: `Phone number ${formData.phone} is already registered.` }));
                      setShowDuplicateModal(true);
                      return;
                  }
              }

              // 3. Check Parent Phone Duplicate
              if (formData.parent_phone) {
                  const parentPhoneDupes = await checkPhoneDuplicate(formData.parent_phone);
                  if (parentPhoneDupes.length > 0) {
                      setDuplicateStudents(parentPhoneDupes);
                      setDuplicateCheck(prev => ({ ...prev, type: 'phone', message: `Parent contact ${formData.parent_phone} is already registered.` }));
                      setShowDuplicateModal(true);
                      return;
                  }
              }
          } catch (error) {
              console.error("Error checking duplicates:", error);
          }
      }

      if (currentStep < 4) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
      if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  async function handleSubmit(e: React.FormEvent) {
      e?.preventDefault(); 
      if (!validateStep(3)) return;

      setSubmitting(true);

      try {
          
          // 0. Check for duplicates (only if not already confirmed)
          const studentName = `${formData.first_name} ${formData.last_name}`.trim();
          
          // Check Name
          const nameQuery = query(collection(db, "students"), where("student_name", "==", studentName));
          const nameSnap = await getDocs(nameQuery);
          if (!nameSnap.empty) {
              setDuplicateStudents(nameSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
              setDuplicateCheck(prev => ({ ...prev, type: 'name' }));
              setShowDuplicateModal(true);
              setSubmitting(false);
              return;
          }

          // Check Student Phone
          if (formData.phone) {
              const phoneDupes = await checkPhoneDuplicate(formData.phone);
              if (phoneDupes.length > 0) {
                  setDuplicateStudents(phoneDupes);
                  setDuplicateCheck(prev => ({ ...prev, type: 'phone', message: `Phone number ${formData.phone} is already registered.` }));
                  setShowDuplicateModal(true);
                  setSubmitting(false);
                  return;
              }
          }

          // Check Parent Phone
          if (formData.parent_phone) {
              const parentPhoneDupes = await checkPhoneDuplicate(formData.parent_phone);
              if (parentPhoneDupes.length > 0) {
                  setDuplicateStudents(parentPhoneDupes);
                  setDuplicateCheck(prev => ({ ...prev, type: 'phone', message: `Parent contact ${formData.parent_phone} is already registered.` }));
                  setShowDuplicateModal(true);
                  setSubmitting(false);
                  return;
              }
          }

          await createStudent();
          
      } catch (error) {
          console.error("Error checking duplicates:", error);
          alert("Failed to validate student data");
          setSubmitting(false);
      }
  }

  const createStudent = async () => {
      setSubmitting(true);
      try {
          // 1. Upload Image
          let imageUrl = "";
          if (imageFile) {
              imageUrl = await uploadImage(imageFile, `students/${Date.now()}_${imageFile.name}`);
          }

          // 2. Create Student
          const studentPayload: any = {
              first_name: formData.first_name,
              last_name: formData.last_name,
              student_name: `${formData.first_name} ${formData.last_name}`.trim(),
              student_code: formData.student_code || `STU-${Date.now().toString().slice(-6)}`,
              age: calculateAge(formData.dob),
              gender: formData.gender,
              dob: formData.dob,
              pob: formData.pob,
              nationality: formData.nationality,
              branch_id: formData.branch_id, 
              address: formData.address,
              phone: formData.phone,
              email: formData.email,
              
              parent_phone: formData.parent_phone,
              mother_name: formData.mother_name,
              father_name: formData.father_name,
              
              status: formData.status,
              admission_date: formData.admission_date,
              image_url: imageUrl,
              branch_name: branches.find(b => b.branch_id === formData.branch_id)?.branch_name || ""
          };

          const newStudent = await addStudent(studentPayload);
          const newEnrollments = [];




          // Distribute paid amount across programs (if multiple)
          // If Skip Payment, we force remainingPaid to 0.
          let remainingPaid = Number(formData.paid_amount);

          // Get Discount Percentage (Global)
          const discountPercent = Number(discountInput) || 0;

          // Find the active term
          const activeTerm = terms.find(t => t.status === 'Active');
          
          // Find next term (simple date-based check)
          const nextTerm = activeTerm 
              ? terms
                  .filter(t => t.start_date > activeTerm.start_date)
                  .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
              : undefined;

          for (const prog of selectedPrograms) {
               // Base Price logic (Total for this program selection)
               // Note: prog.price already includes next term fee if selected (calculated in handleAddProgram)
               const fullPrice = Number(prog.price);
               
               // Check if splitting is needed
               if (prog.include_next_term && activeTerm && nextTerm) {
                   // SPLIT ENROLLMENT: 1. Current Term partial, 2. Next Term full
                   
                   // Re-calculate individual fees
                   // We need to adhere to how handleAddProgram calculated it to reverse it correctly
                   // Logic was: calculatedPrice = (feePerSession * remainingSessions) + (includeNext ? program.price : 0)
                   
                   const originalProgram = programs.find(p => p.id === prog.program_id);
                   const baseProgramPrice = Number(originalProgram?.price || 0); // Full term price
                   
                   const nextTermFee = baseProgramPrice;
                   const currentTermFee = fullPrice - nextTermFee;

                   // 1. Current Term Enrollment
                   const discount1 = currentTermFee * (discountPercent / 100);
                   const netFee1 = currentTermFee - discount1;

                   const amountAllocated1 = Math.min(remainingPaid, netFee1);
                   remainingPaid = Math.max(0, remainingPaid - amountAllocated1);

                   const enrollmentPayload1 = {
                      student_id: newStudent.id,
                      class_id: prog.class_id,
                      total_amount: currentTermFee,
                      discount: discount1, 
                      paid_amount: amountAllocated1, 
                      payment_status: (amountAllocated1 >= netFee1 - 0.01) ? 'Paid' : 'Unpaid', // Tolerance for float
                      payment_type: formData.payment_type,
                      enrollment_status: 'Active',

                      session_fee: Number(originalProgram?.session_fee || (baseProgramPrice / (prog.total_sessions || 1))),
                      start_session: Number(prog.start_session || 1),
                      include_next_term: false, // Handled by separate enrollment
                      term: activeTerm.term_name || '',
                      term_id: activeTerm.term_id || '',
                      payment_due_date: formData.payment_due_date || "" 
                  };
                  
                  const enrId1 = await addEnrollment(enrollmentPayload1 as any);
                  newEnrollments.push({ 
                      enrollment_id: enrId1, 
                      ...enrollmentPayload1,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                      admission_date: prog.admission_date
                  });

                  // 2. Next Term Enrollment
                  const discount2 = nextTermFee * (discountPercent / 100);
                  const netFee2 = nextTermFee - discount2;

                  const amountAllocated2 = Math.min(remainingPaid, netFee2);
                  remainingPaid = Math.max(0, remainingPaid - amountAllocated2);

                  const enrollmentPayload2 = {
                      student_id: newStudent.id,
                      class_id: prog.class_id,
                      total_amount: nextTermFee,
                      discount: discount2,
                      paid_amount: amountAllocated2,
                      payment_status: (amountAllocated2 >= netFee2 - 0.01) ? 'Paid' : 'Unpaid',
                      payment_type: formData.payment_type,
                      enrollment_status: 'Active', // Or 'Upcoming'? User said "student will have attendance in next term also", usually means Active in that term context.
                      
                      session_fee: Number(originalProgram?.session_fee || (baseProgramPrice / (prog.total_sessions || 1))),
                      start_session: 1, // Next term starts at 1
                      include_next_term: false,
                      term: nextTerm.term_name || '',
                      term_id: nextTerm.term_id || '',
                      payment_due_date: formData.payment_due_date || ""
                  };

                  const enrId2 = await addEnrollment(enrollmentPayload2 as any);
                  newEnrollments.push({
                      enrollment_id: enrId2,
                      ...enrollmentPayload2,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                      admission_date: prog.admission_date
                  });


               } else {
                   // STANDARD SINGLE ENROLLMENT
                   // Calculate item discount
                   const discount = fullPrice * (discountPercent / 100);
                   const netFee = fullPrice - discount;

                   const amountAllocated = Math.min(remainingPaid, netFee);
                   remainingPaid = Math.max(0, remainingPaid - amountAllocated);

                   const enrollmentPayload = {
                      student_id: newStudent.id,
                      class_id: prog.class_id,
                      total_amount: fullPrice,
                      discount: discount, 
                      paid_amount: amountAllocated, 
                      payment_status: (amountAllocated >= netFee - 0.01) ? 'Paid' : 'Unpaid', 
                      payment_type: formData.payment_type,
                      enrollment_status: 'Active',

                      session_fee: Number(prog.price), // Approx
                      start_session: Number(prog.start_session || 1),
                      include_next_term: prog.include_next_term || false,
                      term: activeTerm?.term_name || '',
                      term_id: activeTerm?.term_id || '',
                      payment_due_date: formData.payment_due_date || "" 
                  };
                  
                  const enrId = await addEnrollment(enrollmentPayload);
                  newEnrollments.push({ 
                      enrollment_id: enrId, 
                      ...enrollmentPayload,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                      admission_date: prog.admission_date
                  });
               }
          }

          // Success! Move to Step 4 (Invoice)
          setCreatedStudent({ student_id: newStudent.id, ...studentPayload, student_code: newStudent.student_code || studentPayload.student_code });
          setCreatedEnrollments(newEnrollments);
          if (generateInvoice) {
              setCurrentStep(4);
          } else {
              router.push('/admin/students?action=success');
          }
          
      } catch (error) {
          console.error("Error creating student:", error);
          alert("Failed to create student");
      } finally {
          setSubmitting(false);
          setShowDuplicateModal(false);
      }
  };

  const handleSaveEarly = async () => {
      alert("This feature is only available after completing the full admission process.");
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

  const handleHeaderBack = () => {
    if (currentStep > 1) {
        prevStep();
    } else {
        router.back();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-24 px-4 font-sans relative">
        
        {/* Header */}
        <div className="flex items-center gap-4 py-6">
            <button onClick={handleHeaderBack} className="p-3 bg-white hover:bg-slate-50 rounded-2xl text-slate-500 transition-all shadow-sm border border-slate-100">
                <ChevronLeft size={20} />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">New Admission</h1>
                <p className="text-slate-500 text-sm font-medium">Create a new student profile and enrollment</p>
            </div>
        </div>

        {/* Stepper */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-8">
            <Stepper currentStep={currentStep} />
        </div>

        <form onSubmit={(e) => e.preventDefault()}> 
            
            {/* STEP 1: Personal Information */}
            {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                     
                     <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <User size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Student & Guardian Info</h3>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">Step 1 of 3</span>
                        </div>
                        
                        <div className="p-8">
                            {/* Student Section */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                
                                {/* Photo Upload */}
                                <div className="md:col-span-3 flex flex-col">
                                    <div className="relative group w-full aspect-[3/4] rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-indigo-400 hover:bg-indigo-50/10 cursor-pointer shadow-inner">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-white text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                                                    <Upload size={20} />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider group-hover:text-indigo-500">Upload Photo</span>
                                            </>
                                        )}
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    </div>
                                </div>

                                {/* Student Fields */}
                                <div className="md:col-span-9 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                        <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
                                        <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                                        
                                        <Select label="Branch Name" name="branch_id" value={formData.branch_id} onChange={handleInputChange} required>
                                            <option value="">Select Branch</option>
                                            {branches.map(b => (
                                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                            ))}
                                        </Select>
                                        
                                        <Select label="Gender" name="gender" value={formData.gender} onChange={handleInputChange} required>
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </Select>

                                        <Input label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleInputChange} required />
                                        <Input label="Place of Birth" name="pob" value={formData.pob} onChange={handleInputChange} icon={<MapPin size={16} />} />
                                        
                                        <Select label="Nationality" name="nationality" value={formData.nationality} onChange={handleInputChange} required>
                                            <option value="">Select Nationality</option>
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                                            ))}
                                        </Select>

                                        <Input 
                                            label="Phone Number" 
                                            name="phone" 
                                            value={formData.phone} 
                                            onChange={handleInputChange} 
                                            icon={<Phone size={16} />} 
                                            error={validationErrors.phone}
                                        />

                                        <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleInputChange} icon={<Mail size={16} />} />
                                    </div>

                                    {/* Divider */}
                                    <div className="relative py-4">
                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                            <div className="w-full border-t border-slate-100"></div>
                                        </div>
                                     
                                    </div>

                                    {/* Guardian Fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                        <Input label="Father's Name" name="father_name" value={formData.father_name} onChange={handleInputChange} />
                                        <Input label="Mother's Name" name="mother_name" value={formData.mother_name} onChange={handleInputChange} />
                                        <Input label="Contact Number" name="parent_phone" value={formData.parent_phone} onChange={handleInputChange} required icon={<Phone size={16} />} error={validationErrors.parent_phone} />
                                        <Input label="Full Address" name="address" value={formData.address} onChange={handleInputChange} icon={<MapPin size={16} />} />
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                </div>
            )}

            {/* STEP 2: Enrollment */}
            {currentStep === 2 && (
                <div className="max-w-3xl mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                            <BookOpen size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Enrollment Details</h3>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* Program List */}
                        <div className="space-y-3">
                            {selectedPrograms.map((prog, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl group transition-all hover:bg-indigo-50/30 hover:border-indigo-100">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            {prog.program_name}
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">ACTIVE</span>
                                        </h4>
                                        <div className="flex gap-4 mt-1">
                                            <p className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">Class: {prog.class_name}</p>
                                        </div>
                                        <p className="text-xs text-indigo-600 font-bold mt-2">${prog.price}</p>
                                    </div>
                                     <div className="flex items-center gap-1">
                                         <button 
                                            onClick={() => handleEditProgram(idx)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit Details"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleRemoveProgram(idx)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Remove Program"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                             {selectedPrograms.length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
                                        <BookOpen size={20} />
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">No programs added yet.</p>
                                    <p className="text-slate-400 text-xs">Click "Add Program" to enroll student.</p>
                                </div>
                            )}

                            <button 
                                onClick={() => setIsAddingProgram(true)}
                                className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                <span>Add Program</span>
                            </button>
                        </div>

                         <Select label="Global Status" name="status" value={formData.status} onChange={handleInputChange} required>
                            <option value="Active">Active</option>
                            <option value="Hold">Hold</option>
                        </Select>
                    </div>
                </div>
            )}

            {/* STEP 3: Payment */}
            {currentStep === 3 && (
                 <div className="max-w-3xl mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-200">
                            <CreditCard size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Initial Payment</h3>
                    </div>

                    <div className="p-8 grid grid-cols-1 gap-6">
                         <div className="bg-slate-900 p-6 rounded-2xl flex justify-between items-center text-white shadow-xl shadow-slate-200">
                             <span className="font-medium opacity-80">Total Tuition Fee</span>
                             <span className="text-2xl font-black">${formData.total_amount || '0.00'}</span>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <Input label="Total Amount ($)" name="total_amount" type="number" value={formData.total_amount} onChange={handleInputChange} required />
                            
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center justify-between">
                                    <span>Discount (Percentage)</span>
                                </label>
                                <div className="relative">
                                     <input 
                                        type="number" 
                                        value={discountInput}
                                        onChange={(e) => setDiscountInput(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm"
                                        placeholder="e.g. 10"
                                        min="0"
                                        max="100"
                                     />
                                     <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                         <span className="text-slate-400 font-bold text-lg">%</span>
                                         {Number(formData.discount) > 0 && (
                                            <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md">
                                                -${Number(formData.discount).toFixed(2)}
                                            </span>
                                         )}
                                     </div>
                                </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                             {/* Payment Status Toggle */}
                             <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Payment Status</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl">
                                    {['Unpaid', 'Paid'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => handlePaymentStatusChange(status as any)}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${paymentStatusOption === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                             </div>

                            <Select label="Payment Method" name="payment_type" value={formData.payment_type} onChange={handleInputChange} required>
                                 <option value="Cash">Cash</option>
                                 <option value="ABA">ABA</option>
                             </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <Input label="Amount Paid ($)" name="paid_amount" type="number" value={formData.paid_amount} onChange={(e: any) => {
                                handleInputChange(e);
                                // Removed auto-switch to Partial
                            }} required />

                            
                             <Input 
                                label="Payment Due Date (Expiry)" 
                                name="payment_due_date" 
                                type="date" 
                                value={formData.payment_due_date} 
                                onChange={handleInputChange} 
                             />
                        </div>
                        

                    </div>
                </div>
            )}

            {/* STEP 4: Invoice */}
            {currentStep === 4 && createdStudent && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    
                    <div className="flex justify-center gap-4 py-4 print:hidden">
                        <button
                            onClick={handlePrint}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Printer size={18} />
                            <span>Print Invoice</span>
                        </button>
                        <button
                            onClick={() => router.push('/admin/students')}
                            className="bg-white text-slate-600 px-6 py-3 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all"
                        >
                            Finish & Return
                        </button>
                    </div>

                    {/* Invoice Paper Preview */}
                    <div ref={invoiceRef} className="bg-white p-12 rounded-[24px] shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-8">
                        

                        {/* Header & School Info */}
                        <div className="flex justify-between items-start mb-8 pb-8 border-b border-slate-100 print:border-slate-300">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm print:border-slate-300">
                                    {school?.logo_url ? (
                                        <img src={school.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-2xl font-black text-indigo-600">{school?.school_name?.charAt(0) || "A"}</span>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-slate-800 tracking-tight">{school?.school_name || "Authentic Advanced Academy"}</h1>
                                    <div className="text-xs font-medium text-slate-500 mt-1 space-y-0.5">
                                        <p className="flex items-center gap-1.5"><MapPin size={11} /> {school?.address || "1st Floor, Boeung Snor Food Village"}</p>
                                        <p className="flex items-center gap-1.5"><Phone size={11} /> {(school as any)?.phone || "089 284 3984"}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-3xl font-black text-slate-200 tracking-tighter uppercase print:text-slate-400">Receipt</h2>
                                <div className="mt-1 space-y-0.5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receipt No</p>
                                    <p className="font-mono text-sm font-bold text-slate-700">#{Math.floor(Math.random() * 100000).toString().padStart(6, '0')}</p>
                                </div>
                                <div className="mt-2 space-y-0.5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                    <p className="font-mono text-sm font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Student Info & Details */}
                        <div className="grid grid-cols-2 gap-12 mb-10">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Bill To</p>
                                <h3 className="text-lg font-bold text-slate-800 mb-1">{createdStudent.first_name} {createdStudent.last_name}</h3>
                                <div className="space-y-1 text-sm text-slate-500 font-medium">
                                    <p>ID: <span className="text-slate-700 font-bold">{createdStudent.student_code}</span></p>
                                    <p>Gender: <span className="text-slate-700">{createdStudent.gender}</span></p>
                                    <p>Branch: <span className="text-slate-700">{createdStudent.branch_name}</span></p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 print:bg-white print:border-slate-200 flex flex-col justify-center">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="space-y-1">
                                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Term</p>
                                         <p className="text-sm font-bold text-slate-800">
                                            {[...new Set(createdEnrollments.map(e => e.term))].join(', ')}
                                        </p>
                                    </div>
                                    <div className="space-y-1 border-x border-slate-200 print:border-slate-200/50">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</p>
                                        <p className="text-sm font-bold text-slate-800">{createdEnrollments[0]?.payment_type}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                                         <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">
                                            PAID
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <table className="w-full mb-8 border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="py-3 pr-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                                    <th className="py-3 px-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Session</th>
                                    <th className="py-3 pl-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50/50">
                                {createdEnrollments.map((enr, idx) => (
                                    <tr key={idx}>
                                        <td className="py-4 pr-4 align-top">
                                            <p className="font-bold text-slate-800 text-sm">{enr.program_name || "Tuition Fee"}</p>
                                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
                                                <span className="flex items-center gap-1.5"><BookOpen size={10} className="text-slate-400" /> {enr.class_name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center align-top">
                                             <span className="font-mono font-bold text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                {enr.start_session}-{enr.total_sessions || 12}
                                            </span>
                                        </td>
                                        <td className="py-4 pl-4 text-right align-top">
                                            <span className="font-bold text-slate-800 text-sm">${Number(enr.total_amount).toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end pt-4 border-t-2 border-slate-100 print:border-slate-300">
                            <div className="w-full max-w-xs space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Total Amount</span>
                                    <span>${createdEnrollments.reduce((sum, e) => sum + Number(e.total_amount), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-emerald-600">
                                    <span>Discount</span>
                                    <span>-${createdEnrollments.reduce((sum, e) => sum + Number(e.discount || 0), 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500 pb-2 border-b border-slate-100 border-dashed">
                                    <span>Paid Amount</span>
                                    <span>-${createdEnrollments.reduce((sum, e) => sum + Number(e.paid_amount), 0).toFixed(2)}</span>
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-20 pt-8 border-t border-dashed border-slate-200 text-center print:mt-10">
                            <p className="text-slate-400 text-xs font-medium">Thank you for choosing Authentic Advanced Academy!</p>
                        </div>

                    </div>
                    
                </div>
            )}
                        

            {/* Add Program Dialog/Modal */}
            {isAddingProgram && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                    <div className="bg-white p-8 border-b border-slate-50 flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">{editingProgramIndex !== null ? 'Edit Program' : 'Add Program'}</h3>
                                <p className="text-sm font-medium text-slate-400">Select program details for enrollment</p>
                            </div>
                        </div>
                        <button onClick={() => { setIsAddingProgram(false); setEditingProgramIndex(null); }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all">
                            <X size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <Select 
                                label="Program" 
                                name="program_id" 
                                value={newProgramData.program_id} 
                                onChange={(e: any) => setNewProgramData(prev => ({ ...prev, program_id: e.target.value }))}
                                required
                            >
                                <option value="">Select Program</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                                ))}
                            </Select>

                            <Select 
                                label="Class" 
                                name="class_id" 
                                value={newProgramData.class_id} 
                                onChange={(e: any) => setNewProgramData(prev => ({ ...prev, class_id: e.target.value }))}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes
                                    .filter(c => !newProgramData.program_id || c.programId === newProgramData.program_id) 
                                    .map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.className}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <Input 
                                label="Start Session" 
                                name="start_session" 
                                type="number" 
                                min="1"
                                max="50"
                                value={newProgramData.start_session} 
                                onChange={(e: any) => setNewProgramData(prev => ({ ...prev, start_session: e.target.value }))}
                                required 
                            />
                            
                            <Input 
                                label="Admission Date" 
                                name="admission_date" 
                                type="date" 
                                value={newProgramData.admission_date} 
                                onChange={(e: any) => setNewProgramData(prev => ({ ...prev, admission_date: e.target.value }))}
                                required 
                            />
                        </div>

                        {/* Custom Checkbox Card */}
                        <div 
                            onClick={() => setNewProgramData(prev => ({ ...prev, include_next_term: !prev.include_next_term }))}
                            className={`relative cursor-pointer group flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 ${newProgramData.include_next_term ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                        >
                            <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${newProgramData.include_next_term ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                {newProgramData.include_next_term && <Check size={14} strokeWidth={3} />}
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${newProgramData.include_next_term ? 'text-indigo-700' : 'text-slate-700'}`}>Include Next Term Fee?</h4>
                                <p className="text-xs font-medium text-slate-400 mt-1 leading-relaxed">
                                    Automatically add the fee for the upcoming term to this invoice.
                                </p>
                            </div>
                        </div>

                    </div>
                    
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button 
                            onClick={() => { setIsAddingProgram(false); setEditingProgramIndex(null); }}
                            className="px-6 py-3.5 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAddProgram}
                            className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200/50 transition-all flex items-center gap-2 active:scale-95 from-indigo-600 to-indigo-700 bg-gradient-to-br"
                        >
                             {editingProgramIndex !== null ? 'Update Program' : 'Add Program'}
                             <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
                </div>
            )}

            {showDuplicateModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                <ShieldAlert size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {duplicateCheck.type === 'phone' ? 'Phone Number Already Exists' : 'Duplicate Student Detected'}
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    {duplicateCheck.type === 'phone' 
                                        ? duplicateCheck.message 
                                        : `We found students with the name "${formData.first_name} ${formData.last_name}" already in the system.`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Existing Records</h4>
                            <div className="space-y-3">
                                {duplicateStudents.map((stu) => (
                                    <div key={stu.id} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                         <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                                            {stu.image_url ? (
                                                <img src={stu.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={20} className="text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h5 className="font-bold text-slate-800">{stu.student_name}</h5>
                                                <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{stu.student_code}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <span>{stu.gender}</span>
                                                <span>•</span>
                                                <span>{stu.dob}</span>
                                                <span>•</span>
                                                <span>{stu.phone}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">

                            <button
                                onClick={() => { setShowDuplicateModal(false); setSubmitting(false); }}
                                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors w-full"
                            >
                                Close & Edit Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-40 flex justify-center">
                <div className="w-full max-w-[70rem] flex justify-end items-center px-4 gap-3">
                    <button 
                        type="button" 
                        onClick={prevStep} 
                        disabled={currentStep === 1 || currentStep === 4}
                        className={`px-8 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all order-1 shadow-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 min-w-[160px] ${currentStep === 1 || currentStep === 4 ? 'hidden' : ''}`}
                    >
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>

                    <div className="flex items-center gap-3 order-2">
                        {currentStep < 3 ? (
                            <button 
                                type="button" 
                                onClick={nextStep}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 min-w-[160px]"
                            >
                                <span>{currentStep === 3 ? 'Review Enrollment' : 'Next Step'}</span>
                                <ArrowRight size={18} />
                            </button>
                        ) : currentStep === 3 ? (
                            <button 
                                type="button" 
                                onClick={(e) => handleSubmit(e as any)}
                                disabled={submitting}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 min-w-[160px]"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
                                <span>Complete Admission</span>
                            </button>
                        ) : null}

                    </div>
                 </div>
            </div>

        </form>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: "Student Info" },
    { id: 2, label: "Enrollment" },
    { id: 3, label: "Payment" },
    { id: 4, label: "Invoice" },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center w-full">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step Circle & Label Container */}
              <div className="relative flex flex-col items-center group">
                <div 
                  className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 z-10
                      ${isActive 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110" 
                          : isCompleted 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "bg-white border-slate-200 text-slate-400"
                      }
                  `}
                >
                  {isCompleted ? <Check size={18} strokeWidth={3} /> : step.id}
                </div>
                
                {/* Absolute Label to prevent layout shift */}
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-max text-center hidden sm:block">
                    <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-indigo-600' : isCompleted ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {step.label}
                    </span>
                </div>
              </div>

              {/* Connecting Line (Not for last item) */}
              {!isLast && (
                <div className="flex-1 mx-4 h-[2px] bg-slate-100 relative">
                    <div 
                        className="absolute inset-0 bg-indigo-600 transition-all duration-500 ease-out origin-left"
                        style={{ transform: `scaleX(${isCompleted ? 1 : 0})` }}
                    />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Spacer for labels */}
      <div className="h-12" /> 
    </div>
  );
}

function Input({ label, name, type = "text", required, placeholder, value, onChange, icon }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
                <input 
                    name={name} 
                    type={type} 
                    required={required} 
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pr-12 pl-4' : 'px-4'} py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm`}
                />
                {icon && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    )
}

function Select({ label, name, required, children, value, onChange, icon }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
                <select 
                    name={name} 
                    required={required} 
                    value={value}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pl-20' : 'pl-4'} pr-10 py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 appearance-none cursor-pointer shadow-sm`}
                >
                    {children}
                </select>
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none">
                        {icon}
                    </div>
                )}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                </div>
            </div>
        </div>
    )
}
