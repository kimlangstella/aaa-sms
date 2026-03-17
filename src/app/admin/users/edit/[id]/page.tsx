"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { branchService } from "@/services/branchService";
import { userService } from "@/services/userService";
import { Branch, UserRole, AppUser } from "@/lib/types";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { 
  ArrowLeft,
  Loader2,
  ChevronDown,
  X,
  Check
} from "lucide-react";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);

  // Form State
  const [mainBranch, setMainBranch] = useState("");
  const [otherBranches, setOtherBranches] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(false);
  const [isOtherBranchDropdownOpen, setIsOtherBranchDropdownOpen] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    const unsubBranches = branchService.subscribe(setBranches);
    
    // Fetch initial user data
    if (userId) {
        userService.getUserById(userId).then(user => {
            if (user) {
                setUserProfile(user);
                setFullName(user.name || "");
                setEmail(user.email || "");
                setRole(user.role || "admin");
                setActive(user.active !== undefined ? user.active : true);
                
                // For a real app, gender/phone might be stored in a subcollection or extended profile
                // Here we just use default empty strings since they aren't on AppUser by default
                
                // Branch Logic
                if (user.role === 'superAdmin') {
                    setAllBranches(true);
                    setMainBranch(user.branchIds?.[0] || "");
                    setOtherBranches(user.branchIds?.slice(1) || []);
                } else {
                    const branches = user.branchIds || [];
                    if (branches.length > 0) {
                        setMainBranch(branches[0]);
                        setOtherBranches(branches.slice(1));
                    }
                }
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }

    return () => unsubBranches();
  }, [userId]);

  const handleOtherBranchToggle = (branchId: string) => {
    setOtherBranches(prev => 
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainBranch && role !== 'superAdmin') {
        alert("Main Branch is required for Admins.");
        return;
    }
    setSaving(true);

    try {
      // Determine final branch array
      let finalBranches: string[] = [];
      if (allBranches || role === 'superAdmin') {
          finalBranches = branches.map(b => b.branch_id);
      } else {
          // Combine main branch and other branches, ensuring no duplicates
          finalBranches = Array.from(new Set(mainBranch ? [mainBranch, ...otherBranches] : otherBranches));
      }

      await userService.updateProfile(userId, {
          name: fullName,
          role: role as UserRole || 'admin',
          branchIds: finalBranches,
          active: active
      });

      router.push("/admin/users");
      
    } catch (error: any) {
      console.error("Error updating user:", error);
      alert(error.message || "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return (
          <RoleGuard allowedRoles={['superAdmin']}>
              <div className="flex justify-center items-center py-20">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
          </RoleGuard>
      )
  }

  if (!userProfile) {
      return (
          <RoleGuard allowedRoles={['superAdmin']}>
              <div className="text-center py-20 text-slate-500 font-bold">User not found</div>
          </RoleGuard>
      )
  }

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
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Edit User</h1>
            <p className="text-sm font-medium text-slate-500">Update administrator account details</p>
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
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${allBranches || role === 'superAdmin' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                            {(allBranches || role === 'superAdmin') && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors select-none">Select All Branches</span>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={allBranches || role === 'superAdmin'} 
                            onChange={(e) => {
                                if (role === 'superAdmin') return; // Super admin is always all branches
                                setAllBranches(e.target.checked);
                                if (e.target.checked) setOtherBranches([]);
                            }} 
                            disabled={role === 'superAdmin'}
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
                                required={role !== 'superAdmin'}
                                disabled={allBranches || role === 'superAdmin'}
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
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

                        
                        <div className={`relative ${allBranches || role === 'superAdmin' ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div 
                                onClick={() => setIsOtherBranchDropdownOpen(!isOtherBranchDropdownOpen)}
                                className="w-full pl-5 pr-10 py-[15px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-sm cursor-pointer shadow-sm relative flex items-center h-[50px] leading-tight"
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
                                                 <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${otherBranches.includes(b.branch_id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                                                     {otherBranches.includes(b.branch_id) && <Check size={12} strokeWidth={3} />}
                                                 </div>
                                                 <span className="text-sm font-semibold text-slate-700 select-none flex-1">
                                                     {b.branch_name}
                                                 </span>
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
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
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
                        readOnly // Email is usually not editable easily in Firebase
                        className="opacity-70 cursor-not-allowed bg-slate-100"
                    />

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            Status <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <select 
                                value={active ? "active" : "inactive"}
                                onChange={(e) => setActive(e.target.value === "active")}
                                required
                                className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_16px_center] bg-no-repeat"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    
                    <InputGroup 
                        label="Gender" 
                        value={gender}
                        onChange={(e: any) => setGender(e.target.value)}
                        placeholder="N/A"
                        className="opacity-70 cursor-not-allowed bg-slate-100"
                        readOnly
                    />

                    <InputGroup 
                        label="Phone Number" 
                        value={phone}
                        onChange={(e: any) => setPhone(e.target.value)}
                        placeholder="N/A"
                        className="opacity-70 cursor-not-allowed bg-slate-100"
                        readOnly
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
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {saving && <Loader2 size={18} className="animate-spin" />}
                        <span>Save Changes</span>
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
                    className={`w-full pl-5 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-700 text-sm placeholder:text-slate-400 shadow-sm ${props.className || ''}`}
                />
            </div>
        </div>
    );
}


