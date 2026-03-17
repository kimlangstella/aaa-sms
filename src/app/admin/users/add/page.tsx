"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { branchService } from "@/services/branchService";
import { userService } from "@/services/userService";
import { Branch, UserRole } from "@/lib/types";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { 
  ArrowLeft,
  Loader2,
  ChevronDown,
  Building2,
  Shield,
  User as UserIcon,
  Phone,
  Lock,
  Mail,
  X
} from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function AddUserPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [mainBranch, setMainBranch] = useState("");
  const [otherBranches, setOtherBranches] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(false);
  const [isOtherBranchDropdownOpen, setIsOtherBranchDropdownOpen] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const unsubBranches = branchService.subscribe(setBranches);
    return () => unsubBranches();
  }, []);

  const handleOtherBranchToggle = (branchId: string) => {
    setOtherBranches(prev => 
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainBranch) {
        alert("Main Branch is required.");
        return;
    }
    setLoading(true);

    try {
      // 1. Create User in secondary Firebase instance to avoid signing out current admin
      const secondaryApp = getApps().length > 1 ? getApps()[1] : initializeApp(app.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      // Update auth profile with name
      await updateAuthProfile(newUser, {
          displayName: fullName
      });

      // 2. Create the user profile in Firestore
      // Determine final branch array
      let finalBranches: string[] = [];
      if (allBranches) {
          finalBranches = branches.map(b => b.branch_id);
      } else {
          // Combine main branch and other branches, ensuring no duplicates
          finalBranches = Array.from(new Set([mainBranch, ...otherBranches]));
      }

      await userService.createProfile(newUser.uid, email, fullName);
      
      // Update with the full details
      await userService.updateProfile(newUser.uid, {
          role: role as UserRole || 'admin',
          branchIds: finalBranches,
          active: true, // Auto-activate added users? Or pending? Let's auto-activate since superAdmin is creating them
          // We can store gender and phone in a custom field if we extend AppUser later, but for now they are metadata.
          // Extending AppUser for now:
      });

      // Sign out from the secondary instance just to be clean
      await secondaryAuth.signOut();

      router.push("/admin/users");
      
    } catch (error: any) {
      console.error("Error creating user:", error);
      alert(error.message || "Failed to create user. Please check the details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['superAdmin']}>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        
        {/* Header Navigation */}
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Add New User</h1>
            <p className="text-sm font-medium text-slate-500">Create a new administrator or staff account</p>
          </div>
        </div>

        {/* Main Form Form */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50">
               <h2 className="text-lg font-bold text-slate-800">User Information</h2>
               <p className="text-xs font-medium text-slate-500 mt-1">Branch assignments, roles, and personal details.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
                
                {/* Global Branch Controls */}
                <div className="flex justify-end mb-2">
                    <label className="flex items-center gap-1.5 cursor-pointer group px-2 py-1">
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${allBranches ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                            {allBranches && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors select-none">Select All Branches</span>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={allBranches} 
                            onChange={(e) => {
                                setAllBranches(e.target.checked);
                                if (e.target.checked) setOtherBranches([]);
                            }} 
                        />
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Main Branch */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            Main Branch <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                value={mainBranch}
                                onChange={(e) => setMainBranch(e.target.value)}
                                required
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                            >
                                <option value="" disabled>Search and select branch...</option>
                                {branches.map(b => (
                                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Other Branches Multi-Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Other Branch
                        </label>

                        
                        <div className={`relative ${allBranches ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div 
                                onClick={() => setIsOtherBranchDropdownOpen(!isOtherBranchDropdownOpen)}
                                className="w-full pl-5 pr-10 py-[15px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-sm cursor-pointer shadow-sm relative flex items-center h-[50px] leading-tight"
                             >
                                  <span className={`block truncate w-full pr-4 ${otherBranches.length > 0 ? "text-slate-700" : "text-slate-400 font-medium"}`}>
                                      {otherBranches.length > 0 
                                          ? otherBranches.map(id => branches.find(b => b.branch_id === id)?.branch_name).filter(Boolean).join(', ')
                                          : 'Search and select branches...'}
                                  </span>
                                  <ChevronDown className={`absolute right-4 text-slate-400 transition-transform ${isOtherBranchDropdownOpen ? 'rotate-180' : ''}`} size={16} />
                             </div>
                             
                             {/* Custom Multi-Select Dropdown */}
                             {isOtherBranchDropdownOpen && (
                                 <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                                     <div className="p-2 space-y-1">
                                         {branches.filter(b => b.branch_id !== mainBranch).map(b => (
                                             <label 
                                                key={b.branch_id} 
                                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
                                             >
                                                 <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${otherBranches.includes(b.branch_id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                                     {otherBranches.includes(b.branch_id) && <Check size={12} strokeWidth={3} />}
                                                 </div>
                                                 <span className="text-sm font-semibold text-slate-700 select-none flex-1">
                                                     {b.branch_name}
                                                 </span>
                                                 {/* Hidden Checkbox for Accessibility/Logic */}
                                                 <input 
                                                     type="checkbox" 
                                                     className="hidden" 
                                                     checked={otherBranches.includes(b.branch_id)}
                                                     onChange={() => handleOtherBranchToggle(b.branch_id)}
                                                 />
                                             </label>
                                         ))}
                                         {branches.filter(b => b.branch_id !== mainBranch).length === 0 && (
                                             <p className="px-3 py-2 text-sm text-slate-400 italic">No other branches available.</p>
                                         )}
                                     </div>
                                 </div>
                             )}
                             
                             {/* Overlay to close dropdown when clicking outside */}
                             {isOtherBranchDropdownOpen && (
                                 <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setIsOtherBranchDropdownOpen(false)}
                                 ></div>
                             )}
                        </div>
                    </div>

                    <InputGroup 
                        label="Full Name" 
                        value={fullName}
                        onChange={(e: any) => setFullName(e.target.value)}
                        required
                        placeholder="John Doe"
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            Role <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                value={role}
                                onChange={(e) => setRole(e.target.value as UserRole)}
                                required
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                            >
                                <option value="" disabled>Select an option</option>
                                <option value="admin">Admin</option>
                                <option value="superAdmin">Super Admin</option>
                            </select>
                        </div>
                        {role && (
                             <p className="text-[11px] font-semibold text-slate-400 mt-1.5 ml-1 animate-in fade-in">
                                 {role === 'superAdmin' 
                                     ? "Super Admins have full access to User Management and all system settings across all branches." 
                                     : "Admins have restricted access, primarily managing data within their assigned branches."}
                             </p>
                        )}
                    </div>

                    <InputGroup 
                        label="Email Address" 
                        type="email"
                        value={email}
                        onChange={(e: any) => setEmail(e.target.value)}
                        required
                        placeholder="mail@example.com"
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            Gender <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                required
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                            >
                                <option value="" disabled>Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>

                    <InputGroup 
                        label="Phone Number" 
                        value={phone}
                        onChange={(e: any) => setPhone(e.target.value)}
                        placeholder="012 345 678"
                    />

                    <InputGroup 
                        label="Password" 
                        type="password"
                        value={password}
                        onChange={(e: any) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />
                </div>

                {/* Submit Actions */}
                <div className="flex justify-end gap-4 pt-6 border-t border-slate-50">
                    <button 
                        type="button" 
                        onClick={() => router.back()}
                        className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 bg-white border border-slate-200 shadow-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        <span>Save User</span>
                    </button>
                </div>
            </form>
        </div>
      </div>
    </RoleGuard>
  );
}

// Reusable Input Group Component
function InputGroup({ label, required, type = "text", ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative group">
                <input 
                    type={type}
                    required={required}
                    {...props}
                    className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm placeholder:text-slate-400 shadow-sm"
                />
            </div>
        </div>
    );
}

// Ensure the Check icon is available for rendering 
function Check({ size, strokeWidth, className }: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    )
}
