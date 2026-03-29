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
  Eye,
  Printer,
  DollarSign
} from "lucide-react";
import { onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { termService } from "@/services/termService";
import { inventoryService } from "@/services/inventoryService";
import { productGroupService } from "@/services/productGroupService";
import * as programAddonService from "@/services/programAddonService";
import { addStudent, uploadImage, getClasses, addEnrollment, subscribeToSchoolDetails, checkPhoneDuplicate, getLastSessionForClass } from "@/lib/services/schoolService";
import { Branch, Class, PaymentType, School as SchoolType, Term, ProgramAddon, InventoryItem, EnrollmentAddon } from "@/lib/types";
import { COUNTRIES } from "@/lib/constants";
import { Toast } from "@/components/ui/Toast";

// Helper function to calculate how many calendar weeks remain until the term ends
function calculateWeeksRemaining(admissionDate: string, termEndDate: string): number {
  if (!admissionDate || !termEndDate) return 0;
  
  // Parse as local dates
  const [aYear, aMonth, aDay] = admissionDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = termEndDate.split('-').map(Number);
  
  const admission = new Date(aYear, aMonth - 1, aDay);
  const end = new Date(eYear, eMonth - 1, eDay);
  
  if (end < admission) return 1; // Minimum 1 session if already past end or same day

  // Find the Sunday of the admission week
  const aSun = new Date(admission);
  aSun.setDate(admission.getDate() - admission.getDay());
  aSun.setHours(0, 0, 0, 0);

  // Find the Sunday of the end week
  const eSun = new Date(end);
  eSun.setDate(end.getDate() - end.getDay());
  eSun.setHours(0, 0, 0, 0);

  // Difference in milliseconds
  const diffTime = eSun.getTime() - aSun.getTime();
  // Count the current week as 1, plus any full week gaps
  const weeksRemaining = Math.max(0, Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000))) + 1;
  
  return weeksRemaining;
}

export default function AddStudentPage() {
  const router = useRouter();
  const { profile } = useAuth();
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
      payment_due_date: "", // Initialize
  });

  // Multiple Programs State
  const [selectedPrograms, setSelectedPrograms] = useState<any[]>([]);
  const [isAddingProgram, setIsAddingProgram] = useState(false);
  const [editingProgramIndex, setEditingProgramIndex] = useState<number | null>(null);
  
  // Temporary state for the "Add Program" sub-modal
  const [newProgramData, setNewProgramData] = useState<any>({
        program_id: "",
        class_id: "",
        admission_date: new Date().toISOString().split('T')[0],
        discount: 0,
        paid_amount: 0,
        payment_type: "Cash"
    });
    const [selectedProgramName, setSelectedProgramName] = useState("");

  // Add-ons State
  const [inventoryItems, setInventoryItems] = useState<Record<string, InventoryItem> | null>(null);
  const [productGroups, setProductGroups] = useState<Record<string, string>>({}); // id -> name map
  const [programAddons, setProgramAddons] = useState<ProgramAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);

  const [terms, setTerms] = useState<Term[]>([]);

  useEffect(() => {
    if (!profile) return;
    const branchIds: string[] = []; // Fetch all data regardless of role (admin/superAdmin)
    console.log("Subscription Profile:", profile.role, "Branch IDs:", branchIds);
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    
    // 2. Subscribe to ALL Inventory (to ensure add-ons resolve even if cross-branch)
    // 2. Subscribe to ALL Inventory
    const unsubInventory = inventoryService.subscribe((items) => {
        const itemMap: Record<string, InventoryItem> = {};
        items.forEach(item => {
            if (item.id) itemMap[item.id] = item;
        });
        setInventoryItems(itemMap);
    }, undefined); 

    // 3. Subscribe to ALL Product Groups (for name resolution)
    const unsubGroups = productGroupService.subscribe((groups) => {
        const groupMap: Record<string, string> = {};
        groups.forEach(g => {
            if (g.id) groupMap[g.id] = g.name;
        });
        setProductGroups(groupMap);
    }, undefined);

    // 4. Initial term subscription
    let unsubTerms: (() => void) | undefined;
    if (!formData.branch_id) {
        unsubTerms = termService.subscribe((fetchedTerms) => {
            setTerms(fetchedTerms);
            const active = fetchedTerms.find(t => t.status === 'Active');
            if (active && active.end_date) {
                setFormData(prev => ({ ...prev, payment_due_date: active.end_date }));
            }
        }, branchIds);
    }
    
    return () => {
        unsubBranches();
        unsubInventory();
        unsubGroups();
        if (unsubTerms) unsubTerms();
    };
  }, [profile]);

  // Subscribe to terms filtered by the selected branch
  useEffect(() => {
    if (!formData.branch_id) return;

    const unsubTerms = termService.subscribe((fetchedTerms) => {
        setTerms(fetchedTerms);
        // Auto-set Payment Due Date to Active Term's End Date for this branch
        const active = fetchedTerms.find(t => t.status === 'Active');
        if (active && active.end_date) {
            setFormData(prev => ({ ...prev, payment_due_date: active.end_date }));
        }
    }, [formData.branch_id]);

    return () => unsubTerms();
  }, [formData.branch_id]);

  // When a class or admission date is selected in the sub-modal, auto-fetch the session passed
  useEffect(() => {
      const fetchSession = async () => {
          if (newProgramData.class_id && terms.length > 0) {
              const cls = classes.find(c => c.class_id === newProgramData.class_id);
              // Find the term that contains the admission date
              const activeTerm = terms.find(t => 
                newProgramData.admission_date >= t.start_date && 
                newProgramData.admission_date <= t.end_date
              ) || terms.find(t => t.status === 'Active');
              
              if (cls && activeTerm) {
                  // Calculate how many weeks have passed since the term started
                  const classTotalSessions = cls.totalSessions || 11;
                  
                  const [aYear, aMonth, aDay] = newProgramData.admission_date.split('-').map(Number);
                  const [sYear, sMonth, sDay] = activeTerm.start_date.split('-').map(Number);
                  
                  const admission = new Date(aYear, aMonth - 1, aDay);
                  const start = new Date(sYear, sMonth - 1, sDay);
                  
                  let passed = 0;
                  if (admission > start) {
                      const diffMs = admission.getTime() - start.getTime();
                      // Use ceil to count the current week as "passed" if we are in it
                      passed = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
                  }

                  // FM Branch logic: Default to 11 if it's an FM branch
                  const activeBranch = branches.find(b => b.branch_id === formData.branch_id);
                  const isFM = activeBranch?.branch_name?.toUpperCase().includes("FM");
                  
                  let sessionsToEnroll = Math.max(1, classTotalSessions - passed);
                  
                  if (isFM) {
                      sessionsToEnroll = classTotalSessions; // Default to full 11 for FM
                  }
                  
                  setNewProgramData(prev => ({ ...prev, start_session: sessionsToEnroll.toString() }));
              }
          }
      };
      fetchSession();
  }, [newProgramData.class_id, newProgramData.admission_date, terms, classes]);

  // Fetch Add-ons when a program is selected in the sub-modal
  useEffect(() => {
      if (newProgramData.program_id) {
          programAddonService.getProgramAddons(newProgramData.program_id)
              .then((addons: ProgramAddon[]) => {
                  // Sort them
                  addons.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                  setProgramAddons(addons);
                  
                  // Only auto-select if we are NOT editing an existing program selection, 
                  // or if we switched to a DIFFERENT program than what we were editing.
                  const isEditingSameProgram = editingProgramIndex !== null && selectedPrograms[editingProgramIndex]?.program_id === newProgramData.program_id;
                  
                  if (!isEditingSameProgram) {
                      const initialSelected = addons.map(addon => {
                          const item = inventoryItems ? inventoryItems[addon.itemId] : undefined;
                          const groupName = item?.groupId ? productGroups[item.groupId] : "";
                          
                          let name = addon.label || "";
                          if (!name && item) {
                              name = groupName ? `${item.name} ${groupName}` : item.name;
                          }

                          if (!name && inventoryItems === null) {
                              return null;
                          }

                          const variants = item?.attributes?.variants || [];
                          const hasVariants = item?.attributes?.hasVariants && variants.length > 0;
                          const primaryVariant = variants[0];

                          return {
                              itemId: addon.itemId,
                              nameSnapshot: name || (inventoryItems === null ? `Loading...` : `Unknown Item (${addon.itemId.substring(0,6)})`),
                              priceSnapshot: hasVariants ? (primaryVariant.retailPrice || 0) : (item?.price || 0),
                              qty: addon.defaultQty || 1,
                              selected: !addon.isOptional || addon.isRecommended,
                              variantId: hasVariants ? primaryVariant.id : undefined,
                              variantName: hasVariants ? primaryVariant.name : undefined
                          };
                      }).filter(a => a !== null && a.selected) as any[];
                      
                      setSelectedAddons(initialSelected);
                  }
              })
              .catch(console.error);
      } else {
          setProgramAddons([]);
          setSelectedAddons([]);
      }
  }, [newProgramData.program_id, inventoryItems, editingProgramIndex]);

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

          // Allow selection even if item is not yet in cache, fallback to label
          const variants = item?.attributes?.variants || [];
          const hasVariants = item?.attributes?.hasVariants && variants.length > 0;
          const primaryVariant = variants[0];

          setSelectedAddons(prev => [...prev, {
              itemId: addon.itemId,
              nameSnapshot: name || (inventoryItems === null ? `Loading...` : `Unknown Item (${addon.itemId.substring(0,6)})`),
              priceSnapshot: hasVariants ? (primaryVariant.retailPrice || 0) : (item?.price || 0),
              qty: addon.defaultQty || 1,
              selected: true,
              variantId: hasVariants ? primaryVariant.id : undefined,
              variantName: hasVariants ? primaryVariant.name : undefined
          } as any]);
      }
  };

  const updateAddonVariant = (itemId: string, variantId: string) => {
      setSelectedAddons(prev => prev.map((a: any) => {
          if (a.itemId === itemId) {
              const item = inventoryItems ? inventoryItems[itemId] : undefined;
              const variants = item?.attributes?.variants || [];
              const variant = variants.find((v: any) => v.id === variantId);
              
              return { 
                ...a, 
                variantId, 
                variantName: variant?.name,
                priceSnapshot: variant?.retailPrice ?? a.priceSnapshot 
              };
          }
          return a;
      }));
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

    const resetNewProgramModal = () => {
        setNewProgramData({
            program_id: "",
            class_id: "",
            admission_date: new Date().toISOString().split('T')[0],
            discount: 0,
            paid_amount: 0,
            payment_type: "Cash"
        });
        setSelectedProgramName("");
        setEditingProgramIndex(null);
        setIsAddingProgram(false);
        // setHasSubmittedDiscount(false); // This variable is not defined in the provided code.
    };

  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Duplicate Check State
  const [duplicateCheck, setDuplicateCheck] = useState<{
      isChecking: boolean;
      exists: boolean;
      message: string;
      type: 'name' | 'phone';
      bypass: boolean;
  }>({ isChecking: false, exists: false, message: "", type: 'name', bypass: false });

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const validatePhone = (phone: string) => {
      // Allow empty string if it's not a required field, otherwise validate
      if (!phone) return true;
      // Allow 9 or 10 digits starting with 0, ignoring spaces or dashes
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const phoneRegex = /^0\d{8,9}$/; 
      return phoneRegex.test(cleanPhone);
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
          // 1. Fetch ALL Programs to safely map legacy class program_names
          const unsubAllPrograms = programService.subscribe((allProgs) => {
              const programMap: Record<string, any> = {};
              allProgs.forEach(p => { programMap[p.id] = p; });
              
              // Filter programs for the dropdown to only the current branch
              const branchProgs = allProgs.filter(p => !p.branchId || p.branchId === formData.branch_id);
              setPrograms(branchProgs);
              
              // 2. Fetch Classes and map program_name
              getClasses(formData.branch_id).then((fetchedClasses) => {
                  const mappedClasses = fetchedClasses.map(c => {
                      const prog = programMap[c.programId];
                      
                      let guessedName = undefined;
                      if (!prog && !c.program_name) {
                          const possibleProgs = Object.values(programMap);
                          const match = possibleProgs.find(p => {
                              const baseName = (p.name || '').toLowerCase().split(' ')[0].replace(/s$/, '');
                              return (c.className || '').toLowerCase().includes(baseName);
                          });
                          if (match) guessedName = match.name;
                      }

                      return {
                          ...c,
                          program_name: prog ? prog.name : (c.program_name || guessedName || undefined)
                      };
                  });
                  setClasses(mappedClasses);
              }).catch(console.error);
          });
          
          return () => unsubAllPrograms();
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
        total_amount: total.toFixed(2),
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
        const sessionsToEnroll = parseInt(newProgramData.start_session) || 1;
        const totalSessions = cls.totalSessions || 11;
        const actualStartSession = Math.max(1, totalSessions - sessionsToEnroll + 1);
        
        let basePrice = Number(program.price);
        let baseSessionFee = program.session_fee ? Number(program.session_fee) : null;
        
        if (newProgramData.variant_id && program.variants) {
            const variant = program.variants.find((v: any) => v.id === newProgramData.variant_id);
            if (variant) {
                basePrice = Number(variant.price);
                baseSessionFee = variant.session_fee ? Number(variant.session_fee) : null;
            }
        }
        
        let feePerSession = 0;
        if (baseSessionFee) {
            feePerSession = baseSessionFee;
        } else {
            feePerSession = basePrice / totalSessions;
        }

        let calculatedPrice = feePerSession * sessionsToEnroll;
        
        console.log(`Calculation: ${feePerSession} * ${sessionsToEnroll} = ${calculatedPrice}`);

        // Add next term if selected (full program price)
        if (newProgramData.include_next_term) {
             calculatedPrice += basePrice;
        }

        // Calculate add-ons price
          const addonsTotal = selectedAddons.reduce((sum, a: any) => sum + ((a.priceSnapshot || 0) * (a.qty || 1)), 0);
          calculatedPrice += addonsTotal;

          if (editingProgramIndex !== null) {
            // Edit existing
            setSelectedPrograms(prev => {
                const newArr = [...prev];
                newArr[editingProgramIndex] = {
                    ...newProgramData,
                    program_name: program.name,
                    class_name: `${cls.days?.length ? cls.days.map(d => d.slice(0, 3)).join(', ') : ''}${cls.startTime ? ` (${cls.startTime}-${cls.endTime})` : ''}`.trim() || cls.className,
                    total_sessions: totalSessions,
                    price: calculatedPrice.toFixed(2),
                    // Store the actual start session for database
                    start_session: actualStartSession,
                    sessions_to_enroll: sessionsToEnroll,
                    include_next_term: newProgramData.include_next_term,
                    addons: [...selectedAddons] // Store current selection
                };
                return newArr;
            });
            setEditingProgramIndex(null);
        } else {
            // Add new
            setSelectedPrograms(prev => [...prev, {
                ...newProgramData,
                program_name: program.name,
                class_name: `${cls.days?.length ? cls.days.map(d => d.slice(0, 3)).join(', ') : ''}${cls.startTime ? ` (${cls.startTime}-${cls.endTime})` : ''}`.trim() || cls.className,
                total_sessions: totalSessions,
                price: calculatedPrice.toFixed(2),
                // Store the actual start session for database
                start_session: actualStartSession,
                sessions_to_enroll: sessionsToEnroll,
                include_next_term: newProgramData.include_next_term,
                addons: [...selectedAddons] // Store current selection
            }]);
        }
        
        // Reset and close
        resetNewProgramModal();
    }
  };
  const handleEditProgram = (index: number) => {
      const prog = selectedPrograms[index];
      setNewProgramData({ ...prog });
      // Find the master program to set the category name
      const masterProgram = programs.find(p => p.id === prog.program_id);
      if (masterProgram) setSelectedProgramName(masterProgram.name);
      
      setSelectedAddons(prog.addons || []); // Load stored addons
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
          if (!formData.parent_phone) {
              errors.parent_phone = "Contact number is required";
          } else if (!validatePhone(formData.parent_phone)) {
               errors.parent_phone = "Invalid format. Use 9-10 digits starting with 0";
          }

          if (formData.phone && !validatePhone(formData.phone)) {
               errors.phone = "Invalid format. Use 9-10 digits starting with 0";
          }

          if (Object.keys(errors).length > 0) {
              setValidationErrors(errors);
              setToast({ 
                  isVisible: true, 
                  message: "Please fill in all required fields correctly", 
                  type: 'error' 
              });
              return false;
          }
      }
      if (step === 2) {
          if (selectedPrograms.length === 0) {
              setToast({ isVisible: true, message: "Please add at least one program to continue", type: 'error' });
              return false;
          }
      }
      if (step === 3) {
           if (!formData.total_amount || !formData.paid_amount || !formData.payment_type) {
               setToast({ isVisible: true, message: "Please complete payment details before admission", type: 'error' });
               return false;
           }
      }
      return true;
  };

  const nextStep = async () => {
      if (!validateStep(currentStep)) return;

      // Step 1: Check for duplicates before proceeding to Enrollment
      if (currentStep === 1) {
          if (duplicateCheck.bypass) {
              setDuplicateCheck(prev => ({ ...prev, bypass: false }));
              setCurrentStep(prev => prev + 1);
              return;
          }

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

      if (currentStep < 4) {
          if (currentStep === 1) setToast({ isVisible: true, message: "Student information validated. Please proceed to enrollment.", type: 'success' });
          if (currentStep === 2) setToast({ isVisible: true, message: "Enrollment details validated. Please proceed to payment.", type: 'success' });
          setCurrentStep(prev => prev + 1);
      }
  };

  const prevStep = () => {
      if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  async function handleSubmit(e: React.FormEvent) {
      e?.preventDefault(); 
      if (!validateStep(3)) return;

      setSubmitting(true);

      try {
          if (duplicateCheck.bypass) {
               await createStudent();
               return;
          }
          
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

          const actorName = profile?.name || profile?.email || 'Admin';
          const newStudent = await addStudent(studentPayload, actorName);
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
                   let baseProgramPrice = Number(originalProgram?.price || 0); // Full term price
                   let baseSessionFee = originalProgram?.session_fee ? Number(originalProgram.session_fee) : null;
                   
                   if (prog.variant_id && originalProgram?.variants) {
                       const variant = originalProgram.variants.find((v: any) => v.id === prog.variant_id);
                       if (variant) {
                           baseProgramPrice = Number(variant.price);
                           baseSessionFee = variant.session_fee ? Number(variant.session_fee) : null;
                       }
                   }
                   
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

                      session_fee: Number(baseSessionFee || (baseProgramPrice / (prog.total_sessions || 1))),
                      start_session: Number(prog.start_session || 1),
                      include_next_term: false, // Handled by separate enrollment
                      term: activeTerm.term_name || '',
                      term_id: activeTerm.term_id || '',
                      payment_due_date: formData.payment_due_date || "",
                      addons: prog.addons || [] // Include addons
                  };
                  
                   const enrId1 = await addEnrollment(enrollmentPayload1 as any);

                   // STOCK DEDUCTION Logic
                   if (prog.addons && prog.addons.length > 0) {
                       for (const ad of prog.addons) {
                           if (ad.itemId) {
                               await inventoryService.decrementStock(ad.itemId, ad.qty || 1, ad.variantId);
                           }
                       }
                   }
                  newEnrollments.push({ 
                      enrollment_id: enrId1, 
                      ...enrollmentPayload1,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                       admission_date: prog.admission_date,
                       sessions_to_enroll: prog.sessions_to_enroll
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
                      
                      session_fee: Number(baseSessionFee || (baseProgramPrice / (prog.total_sessions || 1))),
                      start_session: 1, // Next term starts at 1
                      include_next_term: false,
                      term: nextTerm.term_name || '',
                      term_id: nextTerm.term_id || '',
                      payment_due_date: formData.payment_due_date || "",
                      addons: [] // Usually addons are only on the first enrollment
                  };

                  const enrId2 = await addEnrollment(enrollmentPayload2 as any);
                  newEnrollments.push({
                      enrollment_id: enrId2,
                      ...enrollmentPayload2,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                       admission_date: prog.admission_date,
                       sessions_to_enroll: prog.sessions_to_enroll
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
                      term_id: activeTerm?.term_id || '',
                      payment_due_date: formData.payment_due_date || "",
                      addons: prog.addons || []
                  };
                  
                  const enrId = await addEnrollment(enrollmentPayload);

                  // STOCK DEDUCTION Logic
                  if (prog.addons && prog.addons.length > 0) {
                      for (const ad of prog.addons) {
                          if (ad.itemId) {
                              await inventoryService.decrementStock(ad.itemId, ad.qty || 1, ad.variantId);
                          }
                      }
                  }

                  newEnrollments.push({ 
                      enrollment_id: enrId, 
                      ...enrollmentPayload,
                      program_name: prog.program_name,
                      class_name: prog.class_name,
                      total_sessions: prog.total_sessions,
                       admission_date: prog.admission_date,
                       sessions_to_enroll: prog.sessions_to_enroll
                  });
               }
          }

          // Success! Move to Step 4 (Invoice)
          setCreatedStudent({ student_id: newStudent.id, ...studentPayload, student_code: newStudent.student_code || studentPayload.student_code });
          setCreatedEnrollments(newEnrollments);
          if (generateInvoice) {
              setCurrentStep(4);
              setToast({ isVisible: true, message: "Student admitted successfully!", type: 'success' });
          } else {
              setToast({ isVisible: true, message: "Student admitted successfully!", type: 'success' });
              setTimeout(() => {
                  router.push('/admin/students?action=success');
              }, 1500);
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

        <Toast isVisible={toast.isVisible} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, isVisible: false })} />

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
                                        <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleInputChange} required error={validationErrors.last_name} />
                                        <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleInputChange} required error={validationErrors.first_name} />
                                        
                                        <Select label="Branch Name" name="branch_id" value={formData.branch_id} onChange={handleInputChange} required error={validationErrors.branch_id}>
                                            <option value="">Select Branch</option>
                                            {branches.map(b => (
                                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                            ))}
                                        </Select>
                                        
                                        <Select label="Gender" name="gender" value={formData.gender} onChange={handleInputChange} required error={validationErrors.gender}>
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </Select>

                                        <Input label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleInputChange} required error={validationErrors.dob} />
                                        <Input label="Place of Birth" name="pob" value={formData.pob} onChange={handleInputChange} icon={<MapPin size={16} />} />
                                        
                                        <Select label="Nationality" name="nationality" value={formData.nationality} onChange={handleInputChange} required error={validationErrors.nationality}>
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

                                        <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleInputChange} icon={<Mail size={16} />} error={validationErrors.email} />
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
                                            <p className="text-xs text-indigo-600 font-medium bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100 shadow-sm">Sessions: {prog.sessions_to_enroll || prog.start_session || 1}</p>
                                        </div>
                                        <p className="text-xs text-indigo-600 font-bold mt-2">${prog.price}</p>
                                    </div>
                                      <div className="flex items-center gap-1">
                                         <button 
                                            onClick={() => handleRemoveProgram(idx)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Delete Program"
                                        >
                                            <X size={16} />
                                        </button>
                                         <button 
                                            onClick={() => handleEditProgram(idx)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit Details"
                                        >
                                            <Edit2 size={16} />
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
                                onClick={() => {
                                    resetNewProgramModal();
                                    setIsAddingProgram(true);
                                }}
                                className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
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

            {/* STEP 3: Payment */}
            {currentStep === 3 && (
                 <div className="max-w-3xl mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                     <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-200">
                            <CreditCard size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Payment</h3>
                    </div>

                    <div className="p-8 grid grid-cols-1 gap-6">
                         <div className="bg-indigo-600 p-6 rounded-2xl flex justify-between items-center text-white shadow-xl shadow-indigo-200/50">
                             <span className="font-medium opacity-90">Total Tuition Fee</span>
                             <span className="text-2xl font-black">${formData.total_amount || '0.00'}</span>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                                        className="w-full px-4 py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm"
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
                     {/* Invoice Paper Preview */}
                     <div ref={invoiceRef} className="bg-white p-12 rounded-none print:p-8 max-w-[210mm] mx-auto overflow-hidden text-slate-900 leading-tight border border-slate-100 mb-20">
                         
                         {/* Header & School Info */}
                         <div className="flex justify-between items-center mb-10 pb-6 border-b-2 border-slate-900">
                              <div className="flex items-center gap-6">
                                 <div className="w-20 h-20 bg-white flex items-center justify-center overflow-hidden border border-slate-200">
                                     {school?.logo_url ? (
                                         <img src={school.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                     ) : (
                                         <span className="text-3xl font-black text-indigo-600">AAA</span>
                                     )}
                                 </div>
                                 <div className="flex-1">
                                     <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none mb-1">{school?.school_name || "Authentic Advanced Academy"}</h1>
                                     <div className="text-[11px] font-bold text-slate-600 space-y-0.5">
                                         <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-400" /> {school?.address || "1st Floor, Boeung Snor Food Village"}</p>
                                         <p className="flex items-center gap-2"><Phone size={12} className="text-slate-400" /> {(school as any)?.phone || "089 284 3984"}</p>
                                     </div>
                                 </div>
                              </div>
                              <div className="text-right">
                                  {/* Receipt No Removed as per user request */}
                              </div>
                         </div>

                         {/* Paper Form Fields */}
                         <div className="space-y-8 mb-10">
                             {/* Row 1: Name and Date */}
                             <div className="flex items-end gap-10">
                                 <div className="flex-1 flex items-end gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Student Name :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 text-center font-bold text-slate-800 text-sm">
                                         {createdStudent.last_name} - {createdStudent.first_name}
                                     </div>
                                 </div>
                                 <div className="w-64 flex items-end gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Date :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 text-center font-bold text-slate-800 text-sm">
                                         {new Date().toLocaleDateString('en-GB')}
                                     </div>
                                 </div>
                             </div>

                             {/* Row 2: Gender, Session, Schedule */}
                             <div className="flex items-end gap-10">
                                 <div className="flex items-center gap-6">
                                      <span className="text-xs font-black uppercase mb-1">Gender :</span>
                                      <div className="flex items-center gap-6">
                                          <div className="flex items-center gap-2">
                                              <div className={`w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center ${createdStudent.gender === 'Male' ? 'bg-slate-900' : ''}`}>
                                                  {createdStudent.gender === 'Male' && <Check size={12} className="text-white" />}
                                              </div>
                                              <span className="text-xs font-bold">M</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <div className={`w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center ${createdStudent.gender === 'Female' ? 'bg-slate-900' : ''}`}>
                                                  {createdStudent.gender === 'Female' && <Check size={12} className="text-white" />}
                                              </div>
                                              <span className="text-xs font-bold">F</span>
                                          </div>
                                      </div>
                                 </div>
                                 <div className="flex-1 flex items-end gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Session :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 text-center font-bold text-slate-800 text-sm">
                                         {createdEnrollments[0]?.sessions_to_enroll || createdEnrollments[0]?.start_session || 1} Sessions
                                     </div>
                                 </div>
                                 <div className="flex-1 flex items-end gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Schedule :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 text-center font-bold text-slate-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                         {createdEnrollments[0] ? (() => {
                                             const classId = createdEnrollments[0].class_id;
                                             const classInfo = classes.find(c => c.class_id === classId);
                                             if (classInfo) {
                                                 return `${classInfo.days?.join(', ')} | ${classInfo.startTime} - ${classInfo.endTime}`;
                                             }
                                             return createdEnrollments[0].class_name || "N/A";
                                         })() : "Full Day"}
                                     </div>
                                 </div>
                             </div>

                             {/* Row 3: Begin Payment Of */}
                             <div className="space-y-4">
                                 <span className="text-xs font-black uppercase block">Being Payment of :</span>
                                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                                      {/* Programs */}
                                      {createdEnrollments.map((enr, idx) => (
                                          <div key={`prog-${idx}`} className="flex items-center gap-3">
                                              <div className="w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center bg-slate-900">
                                                  <Check size={12} className="text-white" />
                                              </div>
                                              <span className="text-[11px] font-bold">
                                                  {enr.program_name}
                                                  {(enr as any).include_next_term && (
                                                      <span className="ml-1 text-indigo-600 font-black italic text-[9px]">[Inc. New Term]</span>
                                                  )}
                                              </span>
                                              <div className="flex-1 border-b border-slate-400 border-dotted" />
                                          </div>
                                      ))}
                                      
                                      {/* Add-ons from all enrollments */}
                                      {createdEnrollments.flatMap(enr => enr.addons || []).map((addon, idx) => (
                                          <div key={`addon-${idx}`} className="flex items-center gap-3">
                                               <div className="w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center bg-slate-900">
                                                  <Check size={12} className="text-white" />
                                              </div>
                                              <span className="text-[11px] font-bold">
                                                  {addon.nameSnapshot}
                                              </span>
                                              <div className="flex-1 border-b border-slate-400 border-dotted" />
                                          </div>
                                      ))}

                                      {/* Dynamic Placeholders */}
                                      {[...Array(Math.max(0, 4 - (createdEnrollments.length + createdEnrollments.flatMap(enr => enr.addons || []).length)))].map((_, i) => (
                                          <div key={`empty-${i}`} className="flex items-center gap-3 opacity-30">
                                              <div className="w-4 h-4 border border-slate-900 rounded-sm" />
                                              <div className="flex-1 border-b border-slate-400 border-dotted mt-4" />
                                          </div>
                                      ))}
                                  </div>
                             </div>

                             {/* Row 4: Term and Size */}
                             <div className="flex items-end gap-10">
                                 <div className="w-1/2 flex items-center gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Term :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 font-bold text-slate-800 text-sm">
                                          {[...new Set(createdEnrollments.map(e => (e as any).term_name || e.term))].join(', ')}
                                          {createdEnrollments.some(e => (e as any).include_next_term) && " + Next Term"}
                                     </div>
                                 </div>
                                 <div className="w-1/2 flex items-center gap-3">
                                     <span className="text-xs font-black uppercase whitespace-nowrap mb-1">Size :</span>
                                     <div className="flex-1 border-b border-slate-900 pb-1 px-4 font-bold text-slate-800 text-sm">
                                         {/* Blank for manual entry */}
                                     </div>
                                 </div>
                             </div>

                              {/* Amount Boxes Section */}
                             <div className="flex gap-10 pt-4">
                                 <div className="flex-1 space-y-4">
                                     <div className="flex flex-col gap-3">
                                         <span className="text-xs font-black uppercase items-center flex gap-2">
                                             <DollarSign size={14} className="text-indigo-600" />
                                             Total Amount (USD)
                                         </span>
                                         <div className="flex items-center gap-2">
                                             <span className="text-2xl font-black ml-2">
                                                 {Number(createdEnrollments.reduce((sum, e) => sum + (Number(e.total_amount) - Number(e.discount || 0)), 0)).toFixed(2)}
                                             </span>
                                             <span className="text-lg font-bold ml-1">$</span>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="w-72 space-y-4">
                                     <div className="p-4 border-2 border-slate-900 rounded-xl space-y-3">
                                         <span className="text-[10px] font-black uppercase tracking-widest block text-center mb-2">Payment Method</span>
                                         <div className="flex justify-around">
                                             <div className="flex items-center gap-2">
                                                 <div className={`w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center ${createdEnrollments[0]?.payment_type === 'Cash' ? 'bg-slate-900' : ''}`}>
                                                     {createdEnrollments[0]?.payment_type === 'Cash' && <Check size={12} className="text-white" />}
                                                 </div>
                                                 <span className="text-xs font-bold">Cash</span>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                 <div className={`w-4 h-4 border border-slate-900 rounded-sm flex items-center justify-center ${createdEnrollments[0]?.payment_type === 'ABA' ? 'bg-slate-900' : ''}`}>
                                                     {createdEnrollments[0]?.payment_type === 'ABA' && <Check size={12} className="text-white" />}
                                                 </div>
                                                 <span className="text-xs font-bold">ABA</span>
                                             </div>
                                         </div>
                                         {createdEnrollments[0]?.payment_type === 'ABA' && (
                                             <div className="mt-2 text-center">
                                                 <p className="text-[10px] font-bold text-slate-400">Ref No. ________________</p>
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             </div>
                         </div>

                          {/* Footer Signatures */}
                         <div className="mt-20 flex justify-between px-10 gap-20">
                             <div className="text-center w-64">
                                 <div className="h-14 border-b border-slate-900 mb-2 flex items-center justify-center relative">
                                     {profile?.signature_url ? (
                                         <img src={profile.signature_url} alt="Signature" className="max-h-full object-contain mix-blend-multiply" />
                                     ) : (
                                         <div className="h-10" />
                                     )}
                                 </div>
                                 <p className="text-xs font-black uppercase tracking-tight text-slate-900">RECEIVED BY</p>
                                 <p className="text-[10px] text-slate-500 font-black mt-1 uppercase tracking-widest leading-none">
                                     {profile?.name || "Admin Officer Signature"}
                                 </p>
                             </div>
                             <div className="text-center w-64">
                                 <div className="h-14 border-b border-slate-900 mb-2" />
                                 <p className="text-xs font-black uppercase tracking-tight text-slate-900">STUDENT / PARENT</p>
                                 <p className="text-[10px] text-slate-500 font-black mt-1 uppercase tracking-widest leading-none">AUTHORIZED SIGNATURE</p>
                             </div>
                         </div>

                     </div>
                 </div>
             )}
                        

            {/* Add Program Dialog/Modal */}
            {isAddingProgram && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                    <div className="bg-white p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">{editingProgramIndex !== null ? 'Edit Program' : 'Add Program'}</h3>
                                <p className="text-sm font-medium text-slate-400">Select program details for enrollment</p>
                            </div>
                        </div>                         <button onClick={resetNewProgramModal} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all">
                             <X size={20} strokeWidth={2.5} />
                         </button>
                    </div>

                    <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 gap-6">
                            <Select 
                                label="Program" 
                                value={selectedProgramName} 
                                onChange={(e: any) => {
                                    const name = e.target.value;
                                    setSelectedProgramName(name);
                                    const matching = programs.filter(p => p.name === name);
                                    if (matching.length === 1) {
                                        setNewProgramData(prev => ({ ...prev, program_id: matching[0].id, class_id: "" }));
                                    } else {
                                        setNewProgramData(prev => ({ ...prev, program_id: "", class_id: "" }));
                                    }
                                }}
                                required
                            >
                                <option value="">Select Program</option>
                                {Array.from(new Set(programs.map(p => p.name)))
                                    .filter(name => !selectedPrograms.some((sp, idx) => {
                                        const p = programs.find(prog => prog.id === sp.program_id);
                                        return p?.name === name && idx !== editingProgramIndex;
                                    }))
                                    .map((name: any) => <option key={name} value={name}>{name}</option>)}
                            </Select>

                            {(() => {
                                if (!selectedProgramName) return null;
                                const tiers = programs.filter(p => p.name === selectedProgramName).flatMap(p => {
                                    if (p.variants && p.variants.length > 0) {
                                        return p.variants.map((v: any) => ({
                                            id: `${p.id}_${v.id}`,
                                            program_id: p.id,
                                            variant_id: v.id,
                                            variant_name: v.label || v.time || 'Variant',
                                            price: parseFloat(v.price) || 0,
                                            sessions: p.total_sessions || p.durationSessions || 0,
                                            time: v.time
                                        }));
                                    } else {
                                        return [{
                                            id: p.id,
                                            program_id: p.id,
                                            variant_id: undefined,
                                            variant_name: undefined,
                                            price: parseFloat(p.price) || 0,
                                            sessions: p.total_sessions || p.durationSessions || 0,
                                            time: undefined
                                        }];
                                    }
                                });

                                // Deduplicate identical tiers from multiple programs with the same name
                                const uniqueTiersMap = new Map();
                                tiers.forEach(t => {
                                    // Ignore variant_name to ensure visually identical tiers merge even if their hidden labels differ slightly in the DB
                                    const key = `${t.price}-${t.sessions}-${t.time || ''}`;
                                    if (!uniqueTiersMap.has(key)) {
                                        uniqueTiersMap.set(key, t);
                                    }
                                });
                                const uniqueTiers = Array.from(uniqueTiersMap.values());

                                // Only show tier selectors if there are ACTUAL differences (hence uniqueTiers)
                                if (uniqueTiers.length <= 1) {
                                    // If there's only 1 unique tier, but they haven't set the program_id yet, auto-set it
                                    if (uniqueTiers.length === 1 && newProgramData.program_id !== uniqueTiers[0].program_id) {
                                        setTimeout(() => {
                                            setNewProgramData((prev: any) => ({
                                                ...prev,
                                                program_id: uniqueTiers[0].program_id,
                                                variant_id: uniqueTiers[0].variant_id,
                                                variant_name: uniqueTiers[0].variant_name,
                                                class_id: ""
                                            }));
                                        }, 0);
                                    }
                                    return null;
                                }

                                return (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Select Tier (Price & Sessions)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {uniqueTiers.map(t => (
                                                <button
                                                    type="button"
                                                    key={t.id}
                                                    onClick={() => setNewProgramData((prev: any) => ({ 
                                                        ...prev, 
                                                        program_id: t.program_id, 
                                                        variant_id: t.variant_id,
                                                        variant_name: t.variant_name,
                                                        class_id: "" 
                                                    }))}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${newProgramData.program_id === t.program_id && newProgramData.variant_id === t.variant_id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                                                >
                                                    <div className="font-black text-slate-800 text-sm">${t.price}</div>
                                                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">{t.sessions} Sessions {t.time ? `(${t.time})` : ''}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <Select 
                                label="Class" 
                                name="class_id" 
                                value={newProgramData.class_id || ""} 
                                onChange={(e: any) => setNewProgramData((prev: any) => ({ ...prev, class_id: e.target.value }))}
                                required
                                disabled={!newProgramData.program_id && !selectedProgramName}
                            >
                                <option value="">Select Class</option>
                                 {classes
                                    .filter(c => {
                                        if (!newProgramData.program_id) return true;
                                        const selectedP = programs.find(p => p.id === newProgramData.program_id);
                                        if (!selectedP) return c.programId === newProgramData.program_id;
                                        
                                        // Tier 1: Exact programId match (ideal case)
                                        if (c.programId === newProgramData.program_id) return true;
                                        
                                        // Tier 2: Class's program resolves to the same name
                                        const classP = programs.find(p => p.id === c.programId);
                                        if (classP && classP.name === selectedP.name) return true;
                                        
                                        // Tier 3: Saved program_name matches
                                        if (c.program_name && c.program_name === selectedP.name) return true;
                                        
                                        // Tier 4: Fuzzy class name match (for orphaned records with no saved program_name)
                                        const baseName = (selectedP.name || '').toLowerCase().split(' ')[0].replace(/s$/, '');
                                        if (baseName && (c.className || '').toLowerCase().includes(baseName)) return true;
                                        
                                        return false;
                                    })
                                    .map(c => {
                                        const daysFormatted = Array.isArray(c.days) ? c.days.map((d: string) => d.slice(0, 3)).join(', ') : (typeof c.days === 'string' ? c.days : '');
                                        const scheduleStr = `${daysFormatted}${c.startTime ? ` (${c.startTime}-${c.endTime})` : ''}`.trim();
                                        return (
                                            <option key={c.class_id} value={c.class_id}>
                                                {scheduleStr || c.className}
                                            </option>
                                        );
                                    })}
                            </Select>
                        </div>

                        {/* Target Term Info */}
                        {(() => {
                            const term = terms.find(t => 
                                newProgramData.admission_date >= t.start_date && 
                                newProgramData.admission_date <= t.end_date
                            ) || terms.find(t => t.status === 'Active');
                            
                            if (term) {
                                return (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Target Term</p>
                                            <h4 className="text-sm font-black text-indigo-900 leading-tight mb-1">{term.term_name}</h4>
                                            <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-600/70">
                                                <span>{term.start_date}</span>
                                                <ArrowRight size={10} />
                                                <span>{term.end_date}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Input 
                                    label="Sessions to Enroll" 
                                    name="start_session" 
                                    type="number" 
                                    min="1"
                                    max="50"
                                    value={newProgramData.start_session} 
                                    onChange={(e: any) => setNewProgramData(prev => ({ ...prev, start_session: e.target.value }))}
                                    required 
                                />
                                {newProgramData.class_id && (
                                    <p className="text-[10px] text-slate-400 font-medium ml-1 italic">
                                        (Sessions already started: {(classes.find(c => c.class_id === newProgramData.class_id)?.totalSessions || 11) - (parseInt(newProgramData.start_session) || 0)})
                                    </p>
                                )}
                            </div>
                            
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
                            onClick={() => {
                                setNewProgramData(prev => ({ ...prev, include_next_term: !prev.include_next_term }));
                            }}
                            className={`relative cursor-pointer group flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 ${newProgramData.include_next_term ? 'border-indigo-500 bg-indigo-50/10' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}
                        >
                            <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${newProgramData.include_next_term ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-300 group-hover:border-indigo-400 shadow-sm'}`}>
                                {newProgramData.include_next_term && <Check size={14} strokeWidth={4} />}
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${newProgramData.include_next_term ? 'text-indigo-700' : 'text-slate-700'}`}>Include Next Term Fee?</h4>
                                <p className="text-xs font-medium text-slate-400 mt-1 leading-relaxed">
                                    Automatically add the fee for the upcoming term to this invoice.
                                </p>
                            </div>
                        </div>

                        {/* ADD-ONS SECTION */}
                        {programAddons.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Add-ons</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {programAddons.map((addon) => {
                                        const selection = selectedAddons.find(a => a.itemId === addon.itemId);
                                        const isSelected = !!selection;
                                        const item = inventoryItems ? inventoryItems[addon.itemId] : undefined;
                                        const variants = item?.attributes?.variants || [];
                                        const hasVariants = item?.attributes?.hasVariants && variants.length > 0;

                                        return (
                                            <div 
                                                key={addon.id} 
                                                onClick={() => toggleAddon(addon)}
                                                className={`relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${isSelected ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100/60 hover:border-indigo-200 bg-white hover:bg-slate-50/50'}`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <span className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                            {(() => {
                                                                const groupName = item?.groupId ? productGroups[item.groupId] : "";
                                                                let name = addon.label || "";
                                                                if (!name && item) {
                                                                    name = groupName ? `${item.name} ${groupName}` : item.name;
                                                                }
                                                                return name || (inventoryItems === null ? `Loading...` : `Deleted Item`);
                                                            })()}
                                                        </span>
                                                        
                                                        {!addon.isOptional && (
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded leading-none">
                                                                Req
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    {/* Variant Selection Dropdown Inline */}
                                                    {isSelected && hasVariants && (
                                                        <div className="relative w-32">
                                                            <select 
                                                                value={selection?.variantId || ""}
                                                                onChange={(e) => updateAddonVariant(addon.itemId, e.target.value)}
                                                                className="w-full text-xs font-bold p-1.5 pl-2 pr-6 border border-indigo-200 rounded-lg text-indigo-700 bg-white appearance-none outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
                                                            >
                                                                <option value="" disabled>Size...</option>
                                                                {variants.map((v: any) => (
                                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-1 min-w-[3rem] justify-end">
                                                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>$</span>
                                                        <span className={`text-sm font-black ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                            {selection?.priceSnapshot ?? (item?.price || 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">                         <button 
                            onClick={resetNewProgramModal}
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
                                onClick={() => { 
                                    setDuplicateCheck(prev => ({ ...prev, bypass: true }));
                                    setShowDuplicateModal(false);
                                    if (currentStep === 1) {
                                        setCurrentStep(2);
                                        setToast({ isVisible: true, message: "Proceeding with duplicate details...", type: 'success' });
                                    } else {
                                        createStudent();
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

function Input({ label, name, type = "text", required, placeholder, value, onChange, icon, error }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
                <input 
                    name={name} 
                    type={type} 
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pr-12 pl-4' : 'px-4'} py-3.5 rounded-2xl bg-white border ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 outline-none transition-all font-semibold text-sm text-slate-700 placeholder:text-slate-300 shadow-sm`}
                />
                {icon && (
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${error ? 'text-rose-400' : 'text-slate-400'}`}>
                        {icon}
                    </div>
                )}
            </div>
            {error && (
                <p className="text-xs text-rose-500 font-medium ml-1 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    {error}
                </p>
            )}
        </div>
    )
}

function Select({ label, name, required, children, value, onChange, icon, error }: any) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
                <select 
                    name={name} 
                    value={value}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pl-20' : 'pl-4'} pr-10 py-3.5 rounded-2xl bg-white border ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 outline-none transition-all font-semibold text-sm text-slate-700 appearance-none cursor-pointer shadow-sm`}
                >
                    {children}
                </select>
                {icon && (
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${error ? 'text-rose-400' : 'text-slate-400'}`}>
                        {icon}
                    </div>
                )}
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${error ? 'text-rose-400' : 'text-slate-400'}`}>
                    <ChevronDown size={16} />
                </div>
            </div>
            {error && (
                <p className="text-xs text-rose-500 font-medium ml-1 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    {error}
                </p>
            )}
        </div>
    )
}


