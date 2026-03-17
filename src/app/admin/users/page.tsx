"use client";

import { useState, useEffect } from "react";
import { userService } from "@/services/userService";
import { branchService } from "@/services/branchService";
import { AppUser, Branch, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { 
  Users, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Edit2, 
  MapPin, 
  MoreVertical,
  Search,
  Check,
  X,
  AlertCircle,
  Plus,
  Filter,
  XCircle as XCircleIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function UserManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers(setUsers);
    const unsubBranches = branchService.subscribe(setBranches);
    setLoading(false);

    return () => {
      unsubUsers();
      unsubBranches();
    };
  }, []);

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleActive = async (user: AppUser) => {
    try {
      await userService.updateProfile(user.uid, { active: !user.active });
    } catch (error) {
      alert("Failed to update user status");
    }
  };

  const handleUpdateRole = async (user: AppUser, role: UserRole) => {
    try {
      await userService.updateProfile(user.uid, { role });
    } catch (error) {
      alert("Failed to update role");
    }
  };

  const handleToggleBranch = async (user: AppUser, branchId: string) => {
    const currentBranches = user.branchIds || [];
    const newBranches = currentBranches.includes(branchId)
      ? currentBranches.filter(id => id !== branchId)
      : [...currentBranches, branchId];
    
    try {
      await userService.updateProfile(user.uid, { branchIds: newBranches });
    } catch (error) {
      alert("Failed to update branches");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      try {
        await userService.deleteProfile(uid);
      } catch (error) {
        alert("Failed to delete user");
      }
    }
  };

  return (
    <RoleGuard allowedRoles={['superAdmin', 'admin']}>
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <Shield size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Users</h1>
                <p className="text-sm font-medium text-slate-500 mt-1">Admin accounts and access management.</p>
              </div>
            </div>
            
            <button
               onClick={() => router.push('/admin/users/add')}
               className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
               <Plus size={18} />
               <span>Add new</span>
            </button>
          </div>
        </div>

        {/* Filter & Table Container */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          
          {/* Filters */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Role</label>
                <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm text-slate-700 cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat pr-10">
                  <option value="">Admin</option>
                  <option value="superAdmin">Super Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Status</label>
                <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm text-slate-700 cursor-pointer shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat pr-10">
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Search</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-4 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm text-slate-700 shadow-sm"
                  />
                </div>
              </div>
            </div>
            

          </div>

          <div className="w-full h-px bg-slate-100" />

          {/* Table */}
          <div className="overflow-x-auto p-4 md:p-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 pr-4 pl-2 text-xs font-bold text-slate-800 tracking-wide w-12">#</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Name</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Gender</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Phone or Username</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Role</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Branch</th>
                  <th className="py-4 px-4 text-xs font-bold text-slate-800 tracking-wide">Status</th>
                  <th className="py-4 pl-4 text-xs font-bold text-slate-800 tracking-wide text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user, index) => {
                  // Get just initials or first branch logic
                  const userBranchNames = branches.filter(b => user.branchIds?.includes(b.branch_id)).map(b => b.branch_name).join(', ');
                  const branchDisplay = user.role === 'superAdmin' ? 'All' : (userBranchNames || 'N/A');

                  return (
                  <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 pr-4 pl-2 text-sm font-semibold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-bold text-slate-700">{user.name || "N/A"}</p>
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-600">
                      Other {/* This should come from DB, defaulting to Other based on image */}
                    </td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-600">
                      {user.email} {/* Assuming email is used as username/contact here */}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm font-semibold text-slate-600 capitalize">
                        {user.role === 'superAdmin' ? 'Super Admin' : user.role || 'Admin'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                       <span className="text-sm font-medium text-slate-600 truncate max-w-[150px] block">
                         {branchDisplay}
                       </span>
                    </td>
                    <td className="py-4 px-4">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider
                         ${user.active 
                           ? 'bg-emerald-50 text-emerald-600' 
                           : 'bg-slate-100 text-slate-500'}
                       `}>
                         {user.active ? 'Active' : 'Inactive'}
                       </span>
                    </td>
                    <td className="py-4 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => router.push(`/admin/users/edit/${user.uid}`)}
                          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
                          title="Edit User"
                        >
                          <Edit2 size={14} />
                        </button>
                        {profile?.role === 'superAdmin' && (
                          <button 
                            onClick={() => handleDeleteUser(user.uid)}
                            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all relative overflow-hidden"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                            {/* Inner soft red background exactly like reference */}
                            <div className="absolute inset-0 bg-rose-50 opacity-0 hover:opacity-100 transition-opacity z-[-1]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={40} className="text-slate-200" />
                        <p className="font-bold text-slate-400 italic">No users found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            <div className="mt-6">
                <p className="text-sm font-semibold text-slate-500">Total : {filteredUsers.length} records</p>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
