"use client";

import { useState, useEffect } from "react";
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
  X,
  Plus,
  Minus,
  ShieldAlert,
  AlertCircle
} from "lucide-react";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { inventoryService } from "@/services/inventoryService";
import { productGroupService } from "@/services/productGroupService";
import * as programAddonService from "@/services/programAddonService";
import { addStudent, uploadImage, getClasses, addEnrollment, checkPhoneDuplicate, getStudents } from "@/lib/services/schoolService";
import { Branch, Class, PaymentType, ProgramAddon, InventoryItem, EnrollmentAddon, Term, Student } from "@/lib/types";
import { Toast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/useAuth";

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // Step State
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'loading' }>({ isVisible: false, message: '', type: 'success' });
  
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
  });

  // Multiple Programs State
  const [selectedPrograms, setSelectedPrograms] = useState<any[]>([]);
  const [isAddingProgram, setIsAddingProgram] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]); // Programs for dropdown
  
  // Temporary state for the "Add Program" sub-modal
  const [newProgramData, setNewProgramData] = useState({
      program_id: "",
      class_id: "",
      start_session: "",
      include_next_term: false,
      admission_date: new Date().toISOString().split('T')[0]
  });

  // Add-ons State
  const [inventoryItems, setInventoryItems] = useState<Record<string, InventoryItem> | null>(null);
  const [productGroups, setProductGroups] = useState<Record<string, string>>({}); // id -> name map
  const [programAddons, setProgramAddons] = useState<ProgramAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateStudents, setDuplicateStudents] = useState<Student[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<{
      isChecking: boolean;
      exists: boolean;
      message: string;
      type: 'name' | 'phone';
      bypass: boolean;
  }>({ isChecking: false, exists: false, message: "", type: 'name', bypass: false });

  const validatePhone = (phone: string) => {
      // Allow empty string if it's not a required field, otherwise validate
      if (!phone) return true;
      // Allow 9 or 10 digits starting with 0, ignoring spaces or dashes
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const phoneRegex = /^0\d{8,9}$/; 
      return phoneRegex.test(cleanPhone);
  };

  useEffect(() => {
    if (!isOpen || !profile) return;
    
    const branchIds = profile.role === 'admin' ? profile.branchIds : [];
    
    // 1. Subscribe to Branches (Wait for profile)
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    
    // 2. Subscribe to Terms
    const unsubTerms = termService.subscribe(setTerms, branchIds);

    // 3. Subscribe to ALL Inventory for add-on resolution
    const unsubInventory = inventoryService.subscribe((items) => {
        const itemMap: Record<string, InventoryItem> = {};
        items.forEach(item => {
            if (item.id) itemMap[item.id] = item;
        });
        setInventoryItems(itemMap);
    }, undefined); // Bypass branch filter for resolution

    // 4. Subscribe to ALL Product Groups (for name resolution)
    const unsubGroups = productGroupService.subscribe((groups) => {
        const groupMap: Record<string, string> = {};
        groups.forEach(g => {
            if (g.id) groupMap[g.id] = g.name;
        });
        setProductGroups(groupMap);
    }, undefined);

    return () => {
        unsubBranches();
        unsubTerms();
        unsubInventory();
        unsubGroups();
    };
  }, [isOpen, profile]);

  // Fetch classes when branch changes
  useEffect(() => {
     // Clear selections when branch changes
     setSelectedPrograms([]);
     setPrograms([]);
     
     if (formData.branch_id) {
         // Fetch Programs
         programService.getAll([formData.branch_id]).then(setPrograms).catch(console.error);
         // Classes will be fetched when program is selected in sub-modal or we can fetch all for branch
         getClasses(formData.branch_id).then(setClasses).catch(console.error); 
     } else {
         setClasses([]);
         setPrograms([]);
     }
  }, [formData.branch_id]);

  // Update total amount when selectedPrograms changes
  useEffect(() => {
      const total = selectedPrograms.reduce((acc, curr) => acc + (curr.price || 0), 0);
      setFormData(prev => ({ ...prev, total_amount: total.toFixed(2) }));
  }, [selectedPrograms]);

  // Discount State (Percentage Only)
  const [discountInput, setDiscountInput] = useState("0");

  // Recalculate Discount Amount when Total or Input (Percentage) changes
  useEffect(() => {
      const total = Number(formData.total_amount) || 0;
      const inputPercent = Number(discountInput) || 0;
      
      // Calculate amount based on percentage
      const calculatedDiscount = total * (inputPercent / 100);

      // Update formData.discount (actual dollar amount), fixed to 2 decimals
      setFormData(prev => ({ ...prev, discount: calculatedDiscount.toFixed(2) }));
  }, [formData.total_amount, discountInput]);

  // Fetch Add-ons when a program is selected in the sub-modal
  useEffect(() => {
      if (newProgramData.program_id) {
          programAddonService.getProgramAddons(newProgramData.program_id)
              .then((addons: ProgramAddon[]) => {
                  // Sort them
                  addons.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
                  setProgramAddons(addons);
                  
                  // Auto-select required items, or recommended ones
                  const initialSelected = addons.map(addon => {
                      const item = inventoryItems ? inventoryItems[addon.itemId] : undefined;
                      const groupName = item?.groupId ? productGroups[item.groupId] : "";
                      
                      let name = addon.label || "";
                      if (!name && item) {
                          name = groupName ? `${item.name} ${groupName}` : item.name;
                      }

                      // If we don't have a name yet and inventory is still loading, we'll wait
                      if (!name && inventoryItems === null) {
                          return null;
                      }

                      return {
                          itemId: addon.itemId,
                          nameSnapshot: name || (inventoryItems === null ? `Loading...` : `Unknown Item (${addon.itemId.substring(0,6)})`),
                          priceSnapshot: item?.price || 0,
                          qty: addon.defaultQty || 1,
                          // Add a temporary "selected" flag for UI checking
                          selected: !addon.isOptional || addon.isRecommended
                      };
                  }).filter(a => a !== null && a.selected) as any[];
                  
                  setSelectedAddons(initialSelected);
              })
              .catch(console.error);
      } else {
          setProgramAddons([]);
          setSelectedAddons([]);
      }
  }, [newProgramData.program_id, inventoryItems]);
  
  // When a class or admission date is selected, auto-fetch the session passed
  useEffect(() => {
    const fetchSession = async () => {
        if (newProgramData.class_id && terms.length > 0) {
            const cls = classes.find(c => c.class_id === newProgramData.class_id);
            const activeTerm = terms.find(t => 
                newProgramData.admission_date >= t.start_date && 
                newProgramData.admission_date <= t.end_date
            ) || terms.find(t => t.status === 'Active');

            if (cls && activeTerm) {
                const classTotalSessions = cls.totalSessions || 11;
                
                const [aYear, aMonth, aDay] = newProgramData.admission_date.split('-').map(Number);
                const [sYear, sMonth, sDay] = activeTerm.start_date.split('-').map(Number);
                
                const admission = new Date(aYear, aMonth - 1, aDay);
                const start = new Date(sYear, sMonth - 1, sDay);
                
                let passed = 0;
                if (admission > start) {
                    const diffMs = admission.getTime() - start.getTime();
                    // Use ceil to count the partial week as passed
                    passed = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
                }

                // FM Branch logic: Default to 11 if it's an FM branch
                const activeBranch = branches.find(b => b.branch_id === formData.branch_id);
                const isFM = activeBranch?.branch_name?.toUpperCase().includes("FM");

                let sessionsToEnroll = Math.max(1, classTotalSessions - passed);

                if (isFM) {
                    sessionsToEnroll = classTotalSessions; // Default to 11 for FM
                }

                setNewProgramData(prev => ({ ...prev, start_session: sessionsToEnroll.toString() }));
            }
        }
    };
    fetchSession();
  }, [newProgramData.class_id, newProgramData.admission_date, terms, classes]);

  const toggleAddon = (addon: ProgramAddon) => {
      const isSelected = selectedAddons.some(a => a.itemId === addon.itemId);
      if (isSelected) {
          if (!addon.isOptional) return; // Cannot unselect required items
          setSelectedAddons(prev => prev.filter(a => a.itemId !== addon.itemId));
      } else {
          const item = inventoryItems ? inventoryItems[addon.itemId] : undefined;
          const groupName = item?.groupId ? productGroups[item.groupId] : "";
          
          let name = addon.label || "";
          if (!name && item) {
              name = groupName ? `${item.name} ${groupName}` : item.name;
          }

          setSelectedAddons(prev => [...prev, {
              itemId: addon.itemId,
              nameSnapshot: name || (inventoryItems === null ? `Loading...` : `Unknown Item (${addon.itemId.substring(0,6)})`),
              priceSnapshot: item?.price || 0,
              qty: addon.defaultQty || 1,
              selected: true
          } as any]);
      }
  };

  const updateAddonQuantity = (itemId: string, delta: number) => {
      setSelectedAddons(prev => prev.map((a: any) => {
          if (a.itemId === itemId) {
              const currentQty = (a.qty || a.quantity) || 1;
              const newQty = Math.max(1, currentQty + delta);
              return { ...a, qty: newQty };
          }
          return a;
      }));
  };

  const updateAddonPrice = (itemId: string, price: number) => {
      setSelectedAddons(prev => prev.map((a: any) => {
          if (a.itemId === itemId) {
              return { ...a, priceSnapshot: price };
          }
          return a;
      }));
  };

  const updateAddonVariant = (itemId: string, variantId: string) => {
      setSelectedAddons(prev => prev.map((a: any) => {
          if (a.itemId === itemId) {
              return { ...a, variantId };
          }
          return a;
      }));
  };

  const handleAddProgram = () => {
      if (!newProgramData.program_id || !newProgramData.class_id || !newProgramData.start_session) {
          alert("Please fill in all program details");
          return;
      }

      const program = programs.find(p => p.id === newProgramData.program_id);
      const cls = classes.find(c => c.class_id === newProgramData.class_id);

      if (program && cls) {
          // Calculate Fee
          const startSession = parseInt(newProgramData.start_session) || 1;
          const totalSessions = cls.totalSessions || 12; 
          const remainingSessions = Math.max(0, totalSessions - startSession + 1);
          
          let feePerSession = 0;
          if (program.session_fee) {
              feePerSession = Number(program.session_fee);
          } else {
              feePerSession = Number(program.price) / totalSessions;
          }

          let calculatedPrice = feePerSession * remainingSessions;
          
          console.log(`Modal Calculation: ${feePerSession} * ${remainingSessions} = ${calculatedPrice}`);

          // Add next term if selected (full program price)
          if (newProgramData.include_next_term) {
               calculatedPrice += Number(program.price);
          }
          
          // Calculate add-ons price
          const addonsTotal = selectedAddons.reduce((sum, a: any) => sum + ((a.priceSnapshot || a.price || 0) * (a.qty || a.quantity || 1)), 0);
          calculatedPrice += addonsTotal;

          setSelectedPrograms(prev => [...prev, {
              ...newProgramData,
              program_name: program.name, 
              class_name: `${cls.days?.join(', ')} (${cls.startTime} - ${cls.endTime})`,
              total_sessions: totalSessions,
              sessions_to_enroll: remainingSessions,
              price: Number(calculatedPrice.toFixed(2)), 
              include_next_term: newProgramData.include_next_term,
              selectedAddons: selectedAddons.map(a => ({
                  itemId: a.itemId,
                  nameSnapshot: a.nameSnapshot || a.name,
                  priceSnapshot: a.priceSnapshot || a.price,
                  qty: a.qty || a.quantity,
                  variantId: a.variantId
              }))
          }]);
          
          // Reset and close
          setNewProgramData({
              program_id: "",
              class_id: "",
              start_session: "",
              include_next_term: false,
              admission_date: new Date().toISOString().split('T')[0]
          });
          setProgramAddons([]);
          setSelectedAddons([]);
          setIsAddingProgram(false);
      }
  };

  const handleRemoveProgram = (index: number) => {
      setSelectedPrograms(prev => prev.filter((_, i) => i !== index));
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
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      
      if (validationErrors[name]) {
          setValidationErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[name];
              return newErrors;
          });
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
      }

      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const nextStep = async () => {
      if (!validateStep(currentStep)) return;
      
      if (currentStep === 1) {
          if (duplicateCheck.bypass) {
              setDuplicateCheck(prev => ({ ...prev, bypass: false }));
              setCurrentStep(prev => prev + 1);
              return;
          }

          const studentName = `${formData.first_name} ${formData.last_name}`.trim();
          
          try {
              setDuplicateCheck(prev => ({ ...prev, isChecking: true }));
              
              // 1. Check Phone
              const phoneDupes = await checkPhoneDuplicate(formData.parent_phone);
              if (phoneDupes.length > 0) {
                  setDuplicateStudents(phoneDupes as any);
                  setDuplicateCheck({ 
                      isChecking: false, 
                      exists: true, 
                      message: `A student is already registered with the phone number ${formData.parent_phone}.`, 
                      type: 'phone',
                      bypass: false
                  });
                  setShowDuplicateModal(true);
                  return;
              }

              // 2. Check Name
              const allStudents = await getStudents([formData.branch_id]);
              const nameDupes = allStudents.filter(s => s.student_name?.toLowerCase() === studentName.toLowerCase());
              if (nameDupes.length > 0) {
                  setDuplicateStudents(nameDupes as any);
                  setDuplicateCheck({ 
                      isChecking: false, 
                      exists: true, 
                      message: `A student named "${studentName}" is already in the system.`, 
                      type: 'name',
                      bypass: false
                  });
                  setShowDuplicateModal(true);
                  return;
              }
          } catch (error) {
              console.error("Error checking duplicates:", error);
          } finally {
              setDuplicateCheck(prev => ({ ...prev, isChecking: false }));
          }
      }

      if (currentStep < 3) {
          if (currentStep === 1) setToast({ isVisible: true, message: "Student information validated. Please proceed to enrollment.", type: 'success' });
          if (currentStep === 2) setToast({ isVisible: true, message: "Enrollment details validated. Please proceed to payment.", type: 'success' });
          setCurrentStep(prev => prev + 1);
      }
  };

  const prevStep = () => {
      if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setSubmitting(true);

      try {
          // 0. Check for duplicates (only if not already confirmed)
          if (!duplicateCheck.bypass) {
              const phoneDupes = await checkPhoneDuplicate(formData.parent_phone);
              if (phoneDupes.length > 0) {
                    setDuplicateStudents(phoneDupes as any);
                    setDuplicateCheck({ isChecking: false, exists: true, message: `Phone number ${formData.parent_phone} already exists.`, type: 'phone', bypass: false });
                    setShowDuplicateModal(true);
                    return;
              }
          }
          
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
              branch_id: formData.branch_id, // Linked to branch
              address: formData.address,
              phone: formData.phone,
              email: formData.email,
              
              parent_phone: formData.parent_phone,
              mother_name: formData.mother_name,
              father_name: formData.father_name,
              
              status: formData.status,
              admission_date: formData.admission_date,
              image_url: imageUrl,
          };

          const newStudent = await addStudent(studentPayload);

          // 3. Create Enrollments (Loop through selected programs)
          for (const prog of selectedPrograms) {
               const enrollmentPayload = {
                  student_id: newStudent.id,
                  class_id: prog.class_id,
                  // Distribute total paid amount? Or assume paid amount covers all?
                  // Simple logic: First enrollment takes the payment, others marked as Paid or Unpaid based on remaining?
                  // BETTER: Just record the full payment on the first enrollment or split it?
                  // For now, let's just log the total amount on the first enrollment or leave it simple.
                  // User said "add multiple program". 
                  // Let's assign the PAYMENT to the first program for tracking, or split. 
                  // To keep it simple: Record the enrollments. 
                  // If we need to track revenue, we usually track it by transaction, not enrollment field.
                  // But enrollment has `paid_amount`.
                  
                  // Strategy: If paid_amount >= total_amount, all are paid.
                  // If partial, how to split?
                  // Let's apply payment to the first one? No, that messes up "Unpaid" status of others.
                  // Let's divide paid amount proportionally?? Too complex.
                  // Let's assume the user pays for specific programs?
                  // User just enters "Total Paid".
                  
                  // Let's mark all as "Paid" if total paid >= total due.
                  // If partial, mark as "Unpaid" (or "Partial" if we had it).
                  
                  total_amount: prog.price,
                  discount: 0, // Individual discount not yet supported in UI
                  paid_amount: 0, // TODO: Distributed payment logic
                  
                  payment_status: 'Unpaid', 
                  payment_type: formData.payment_type,
                  enrollment_status: 'Active',
                  start_session: Number(prog.start_session),
                  term: '2026-T1', // TODO: Dynamic Term
                  selectedAddons: prog.selectedAddons || []
              };
              
              // Simple "Allocated Payment" logic for now:
              // We'll just save the enrollment. Payment record should ideally be separate.
              // We will just save `paid_amount` on the FIRST enrollment for now to avoid double counting revenue in dashboards?
              // Or better: save 0 and create a separate Transaction record? (Out of scope).
              // Let's put the full price on each enrollment.
              // And set status based on global payment.
              
              const isFullyPaid = Number(formData.paid_amount) >= Number(formData.total_amount);
              enrollmentPayload.payment_status = isFullyPaid ? 'Paid' : 'Unpaid';
              
              // We can't really split the `paid_amount` easily without a complex UI.
              // Let's just set `paid_amount` to `price` if fully paid, or 0 if not, to indicate status.
              // This is a simplification.
              if (isFullyPaid) {
                  enrollmentPayload.paid_amount = prog.price;
              }

              await addEnrollment(enrollmentPayload);
          }

          setToast({ isVisible: true, message: "Student admitted successfully!", type: 'success' });
          setTimeout(() => {
              onSuccess();
          }, 1500);
          
      } catch (error) {
          console.error("Error creating student:", error);
          alert("Failed to create student");
      } finally {
          setSubmitting(false);
      }
  }

  const handleSaveEarly = async () => {
      // Validate Step 1 basics
      if (!formData.first_name || !formData.last_name || !formData.gender || !formData.dob) {
          alert("Please fill in the required student information.");
          return;
      }
      // Trigger submit
      await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white sticky top-0 z-30">
                <div>
                     <h2 className="text-2xl font-black text-slate-800">New Student Admission</h2>
                     <p className="text-slate-500 text-sm font-medium">Complete the 3-step admission process.</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <Toast isVisible={toast.isVisible} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, isVisible: false })} />

            {/* Content Scroll Area */}
            <div className="overflow-y-auto flex-1 p-6 md:p-10 bg-slate-50/50">
                 {/* Stepper */}
                <div className="flex justify-center mb-10">
                    <Stepper currentStep={currentStep} />
                </div>

                <form onSubmit={(e) => e.preventDefault()}> 
                    
                    {/* STEP 1: Student & Parent */}
                    {currentStep === 1 && (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-8">
                                
                                {/* Personal Info Section */}
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <User size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        {/* Photo Upload - 4 Cols */}
                                        <div className="md:col-span-4 flex flex-col items-center">
                                            <div className="relative group w-full max-w-[200px]">
                                                <div className="aspect-square rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-400 group-hover:bg-indigo-50/30 shadow-sm hover:shadow-md">
                                                    {imagePreview ? (
                                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-slate-300 group-hover:text-indigo-400 transition-colors">
                                                            <Upload size={32} />
                                                            <span className="text-xs font-bold uppercase tracking-widest">Upload</span>
                                                        </div>
                                                    )}
                                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inputs - 8 Cols */}
                                        <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5 content-start">
                                            <Select label="Campus Branch" name="branch_id" value={formData.branch_id} onChange={handleInputChange} required>
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

                                            <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                                            <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleInputChange} required />
                                            
                                            <Input label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleInputChange} required />
                                            <Input label="Place of Birth" name="pob" value={formData.pob} onChange={handleInputChange} required />
                                            
                                            <Select label="Nationality" name="nationality" value={formData.nationality} onChange={handleInputChange} required>
                                                <option value="Cambodian">Cambodian</option>
                                                <option value="Foreign">Foreign</option>
                                            </Select>

                                            <Input 
                                                label="Phone Number" 
                                                name="phone" 
                                                value={formData.phone} 
                                                onChange={handleInputChange} 
                                                error={validationErrors.phone}
                                            />
                                            <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleInputChange} />
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="w-full h-px bg-slate-50"></div>

                                {/* Parent Info Section (Merged) */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Parent / Guardian Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input label="Father's Name" name="father_name" value={formData.father_name} onChange={handleInputChange} />
                                        <Input label="Mother's Name" name="mother_name" value={formData.mother_name} onChange={handleInputChange} />
                                        <Input 
                                            label="Contact Number" 
                                            name="parent_phone" 
                                            value={formData.parent_phone} 
                                            onChange={handleInputChange} 
                                            required 
                                            error={validationErrors.parent_phone}
                                        />
                                        <Input label="Address" name="address" value={formData.address} onChange={handleInputChange} required />
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* STEP 2: Enrollment */}
                    {currentStep === 2 && (
                        <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Enrollment Details</h3>
                                    <p className="text-sm text-slate-400 font-medium">Assign student to a class and program</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Program List */}
                                <div className="space-y-3">
                                    {selectedPrograms.map((prog, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{prog.program_name}</h4>
                                                <p className="text-xs text-slate-500">Class: {prog.class_name} • Session: {prog.start_session}</p>
                                                {prog.selectedAddons && prog.selectedAddons.length > 0 && (
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        Add-ons: {prog.selectedAddons.map((a: any) => `${a.qty}x ${a.nameSnapshot}`).join(', ')}
                                                    </p>
                                                )}
                                                <p className="text-xs text-indigo-600 font-bold mt-1">${prog.price}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveProgram(idx)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                     {selectedPrograms.length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                                            <p className="text-slate-400 text-sm font-medium">No programs added yet.</p>
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => setIsAddingProgram(true)}
                                        className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} />
                                        <span>Add Program</span>
                                    </button>
                                </div>

                                 <Select label="Status" name="status" value={formData.status} onChange={handleInputChange} required>
                                    <option value="Active">Active</option>
                                    <option value="Hold">Hold</option>
                                    <option value="Inactive">Inactive</option>
                                </Select>
                            </div>
                        </div>
                    )}
                    
                    {/* Add Program Sub-Modal */}
                    {isAddingProgram && (
                         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md space-y-4">
                                <h3 className="text-lg font-bold text-slate-800">Add Program</h3>
                                <div className="space-y-4">
                                    <Select 
                                        label="Program" 
                                        name="program_id" 
                                        value={newProgramData.program_id} 
                                        onChange={(e: any) => setNewProgramData(prev => ({ ...prev, program_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select Program</option>
                                        {programs
                                            .filter(p => !selectedPrograms.some(sp => sp.program_id === p.id) || p.id === newProgramData.program_id)
                                            .map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                                        ))}
                                    </Select>

                                    <Select 
                                        label="Class" 
                                        name="class_id" 
                                        value={newProgramData.class_id} 
                                        onChange={(e: any) => setNewProgramData(prev => ({ ...prev, class_id: e.target.value }))}
                                        required
                                        disabled={!newProgramData.program_id}
                                    >
                                        <option value="">Select Class</option>
                                        {classes
                                           .filter(c => c.programId === newProgramData.program_id) 
                                           .map(cls => (
                                             <option key={cls.class_id} value={cls.class_id}>
                                                {cls.days?.join(', ')} ({cls.startTime} - {cls.endTime})
                                             </option>
                                        ))}
                                    </Select>

                                    <div className="space-y-1">
                                        <Input 
                                            label="Session" 
                                            name="start_session" 
                                            type="number" 
                                            value={newProgramData.start_session} 
                                            onChange={(e: any) => setNewProgramData(prev => ({ ...prev, start_session: e.target.value }))} 
                                            placeholder="e.g. 1" 
                                            required 
                                        />
                                        {newProgramData.class_id && (
                                            <p className="text-[10px] text-slate-400 font-medium ml-1">
                                                (Sessions already started: {Math.max(0, (parseInt(newProgramData.start_session) || 1) - 1)})
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Custom Checkbox Card */}
                                <div 
                                    onClick={() => setNewProgramData(prev => ({ ...prev, include_next_term: !prev.include_next_term }))}
                                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-4 mt-4 ${
                                        newProgramData.include_next_term 
                                            ? 'bg-indigo-50/50 border-indigo-200' 
                                            : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                        newProgramData.include_next_term 
                                            ? 'bg-indigo-600 border-indigo-600' 
                                            : 'bg-white border-slate-300'
                                    }`}>
                                        {newProgramData.include_next_term && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                <div>
                                    <p className={`text-sm font-bold ${newProgramData.include_next_term ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        Include Next Term Fee?
                                    </p>
                                    <p className={`text-xs mt-0.5 ${newProgramData.include_next_term ? 'text-indigo-600' : 'text-slate-500'}`}>
                                        Automatically add the fee for the upcoming term to this invoice.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Program Add-ons Section */}
                            {programAddons.length > 0 && (
                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Required & Recommended Materials</h4>
                                    <div className="space-y-2">
                                        {programAddons.map((addon, idx) => {
                                            const item = inventoryItems ? inventoryItems[addon.itemId] : undefined;
                                            const groupName = item?.groupId ? productGroups[item.groupId] : "";
                                            let addonName = addon.label || "";
                                            if (!addonName && item) {
                                                addonName = groupName ? `${item.name} ${groupName}` : item.name;
                                            }
                                            if (!addonName) {
                                                addonName = inventoryItems === null ? `Loading...` : `Deleted Item`;
                                            }
                                            const selectedItem = selectedAddons.find(a => a.itemId === addon.itemId);
                                            const isSelected = !!selectedItem;
                                            const selection = selectedItem as any; // Cast for easier access to qty/priceSnapshot
                                            const variants = item?.attributes?.variants || [];

                                            return (
                                                <div key={idx} className={`p-4 rounded-xl border-2 transition-all flex flex-col gap-3 group ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                                                    <div className="flex items-center justify-between min-w-0 w-full gap-4">
                                                        <label className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => toggleAddon(addon)}>
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                                {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0 leading-tight">
                                                                <span className="text-sm font-bold text-slate-700 truncate">{addonName}</span>
                                                                {!addon.isOptional && <span className="text-[10px] font-bold text-rose-500 mt-0.5">Required</span>}
                                                            </div>
                                                        </label>
                                                        
                                                        <div className="flex items-center justify-end gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            {/* Editable Price */}
                                                            {isSelected ? (
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-indigo-100 shadow-sm transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                                                                    <span className="text-xs font-black text-indigo-400">$</span>
                                                                    <input 
                                                                        type="number"
                                                                        value={selection?.priceSnapshot || 0}
                                                                        onChange={(e) => updateAddonPrice(addon.itemId, Number(e.target.value))}
                                                                        className="w-10 bg-transparent border-none outline-none text-sm font-black text-indigo-600 p-0 focus:ring-0 text-center"
                                                                        min="0"
                                                                        step="0.01"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 px-2">
                                                                    <span className="text-xs font-bold text-slate-400">$</span>
                                                                    <span className="text-sm font-bold text-slate-700">{item?.price || 0}</span>
                                                                </div>
                                                            )}

                                                            {/* Quantity Controls */}
                                                            {isSelected && (
                                                                <div className="flex items-center bg-white rounded-xl border border-indigo-100 p-1 shadow-sm">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => updateAddonQuantity(addon.itemId, -1)}
                                                                        className="w-6 h-6 rounded-md hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <span className="text-lg font-bold leading-none mb-0.5">-</span>
                                                                    </button>
                                                                    <span className="w-6 text-center text-xs font-black text-indigo-900">
                                                                        {selection?.qty || 1}
                                                                    </span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => updateAddonQuantity(addon.itemId, 1)}
                                                                        className="w-6 h-6 rounded-md hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <span className="text-base font-bold leading-none mb-0.5">+</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Variant Selection Dropdown */}
                                                    {isSelected && variants.length > 0 && (
                                                        <div className="pt-2 border-t border-indigo-100 mt-1" onClick={(e) => e.stopPropagation()}>
                                                            <div className="relative">
                                                                <select 
                                                                    value={selection?.variantId || ""}
                                                                    onChange={(e) => updateAddonVariant(addon.itemId, e.target.value)}
                                                                    className="w-full text-xs font-bold p-2.5 pl-3 pr-8 border border-slate-200 rounded-lg text-slate-700 bg-white appearance-none outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                                                >
                                                                    <option value="" disabled>Select Size / Variant...</option>
                                                                    {variants.map((v: any) => (
                                                                        <option key={v.id} value={v.id}>{v.name} ({v.stock} left)</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 mt-4">
                                    <button 
                                        onClick={() => setIsAddingProgram(false)}
                                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleAddProgram}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                         </div>
                    )}
                    
                    {/* STEP 3: Payment */}
                    {currentStep === 3 && (
                         <div className="max-w-2xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                    <CreditCard size={24} />
                                </div>
                                 <div>
                                    <h3 className="text-xl font-bold text-slate-800">Payment</h3>
                                    <p className="text-sm text-slate-400 font-medium">Process the first payment for enrollment</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                 <div className="bg-indigo-600 p-6 rounded-2xl flex justify-between items-center text-white shadow-xl shadow-indigo-200/50 mb-4">
                                     <span className="font-medium opacity-90 text-sm">Total Tuition Fee</span>
                                     <span className="text-2xl font-black">${formData.total_amount}</span>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-6">
                                    <Input label="Total Amount ($)" name="total_amount" type="number" value={formData.total_amount} onChange={handleInputChange} required />
                                    
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center justify-between">
                                            <span>Discount</span>
                                        </label>
                                        <div className="relative">
                                             <input 
                                                type="number" 
                                                value={discountInput}
                                                onChange={(e) => setDiscountInput(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm"
                                                placeholder="e.g. 10"
                                                min="0"
                                                max="100"
                                             />
                                             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                 <span className="text-indigo-600 font-black text-lg">%</span>
                                                 {Number(formData.discount) > 0 && (
                                                    <span className="text-white font-bold text-xs bg-indigo-600 px-2.5 py-1 rounded-md shadow-sm shadow-indigo-200">
                                                        -${Number(formData.discount).toFixed(2)}
                                                    </span>
                                                 )}
                                             </div>
                                        </div>
                                    </div>
                                 </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input label="Amount Paid ($)" name="paid_amount" type="number" value={formData.paid_amount} onChange={handleInputChange} required />
                                    <Select label="Payment Method" name="payment_type" value={formData.payment_type} onChange={handleInputChange} required>
                                        <option value="Cash">Cash</option>
                                        <option value="ABA">ABA</option>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Footer / Navigation */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                 <button 
                    type="button" 
                    onClick={prevStep} 
                    disabled={currentStep === 1}
                    className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <ArrowLeft size={18} />
                    <span>Back</span>
                </button>

                <div className="flex items-center gap-4">
                    {/* Save & Finish Button (Visible on Step 1 & 2) */}
                    {currentStep < 3 && (
                         <button 
                            type="button" 
                            onClick={handleSaveEarly}
                            disabled={submitting}
                            className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>Save & Finish</span>
                        </button>
                    )}

                    {currentStep < 3 ? (
                        <button 
                            type="button" 
                            onClick={nextStep}
                            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
                        >
                            <span>Next Step</span>
                            <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button 
                            type="button" 
                            onClick={(e) => handleSubmit(e as any)}
                            disabled={submitting}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
                            <span>Complete Admission</span>
                        </button>
                    )}
                </div>
            </div>

            {showDuplicateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
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
                                    <div key={stu.student_id} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
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
                                onClick={() => { 
                                    setDuplicateCheck(prev => ({ ...prev, bypass: true }));
                                    setShowDuplicateModal(false);
                                    if (currentStep === 1) {
                                        setCurrentStep(2);
                                        setToast({ isVisible: true, message: "Proceeding with duplicate details...", type: 'success' });
                                    } else {
                                        handleSubmit({ preventDefault: () => {} } as any);
                                    }
                                }}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors w-full"
                            >
                                Register Anyway
                            </button>
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
        </div>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { id: 1, label: "Student Info" },
    { id: 2, label: "Enrollment" },
    { id: 3, label: "Payment" },
  ];

  return (
    <div className="flex items-center justify-center w-full">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle & Label */}
            <div className="flex items-center gap-3">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isActive || isCompleted
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-transparent border-slate-300 text-slate-400"
                }`}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : step.id}
              </div>
              
              {/* Label */}
              <span className={`font-bold text-sm ${isActive || isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>

            {/* Connecting Line */}
            {!isLast && (
              <div className={`w-16 md:w-32 h-[2px] mx-4 rounded-full transition-colors ${isCompleted ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Input({ label, name, type = "text", required, placeholder, value, onChange, icon, error }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex justify-between">
                <span>{label} {required && <span className="text-rose-500">*</span>}</span>
                {error && <span className="text-rose-500 normal-case tracking-normal">{error}</span>}
            </label>
            <input 
                name={name} 
                type={type} 
                required={required} 
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={`w-full ${icon ? 'pl-8' : 'px-4'} py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 ${error ? 'border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
            />
        </div>
    )
}

function Select({ label, name, required, children, value, onChange, disabled }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label} {required && <span className="text-rose-500">*</span>}</label>
            <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <select 
                    name={name} 
                    required={required} 
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 appearance-none cursor-pointer disabled:cursor-not-allowed"
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
