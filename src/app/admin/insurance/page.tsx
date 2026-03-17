"use client";

import { useState, useEffect, useMemo } from "react";
import { PolicyCard } from "@/components/insurance/PolicyCard";
import { InsurancePolicy } from "@/types/insurance";
import { 
  ShieldCheck, 
  AlertCircle, 
  Users, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Eye,
  Edit2,
  MoreVertical,
  Clock,
  UserX,
  DollarSign,
  ChevronDown,
  Shield,
  Trash2,
  Check
} from "lucide-react";

import { AddInsuranceModal } from "@/components/modals/AddInsuranceModal";
import { ClaimInsuranceModal } from "@/components/modals/ClaimInsuranceModal";
import { InsuranceClaimsHistoryModal } from "@/components/modals/InsuranceClaimsHistoryModal";
import { subscribeToStudents } from "@/lib/services/schoolService";
import { termService } from "@/services/termService";
import { branchService } from "@/services/branchService";
import { Student, Term, Branch } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

export default function InsurancePage() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [selectedPolicyData, setSelectedPolicyData] = useState<any>(undefined);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Term State
  const [terms, setTerms] = useState<Term[]>([]);
  const [filterTermId, setFilterTermId] = useState<string>("All");

  // Branch State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>("All");

  // Claim State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPolicy, setClaimPolicy] = useState<any>(null);

  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPolicy, setHistoryPolicy] = useState<any>(null);

  useEffect(() => {
    const unsubTerms = termService.subscribe(setTerms);
    const unsubBranches = branchService.subscribe(setBranches, profile?.role === 'admin' ? profile.branchIds : []);
    return () => {
        unsubTerms();
        unsubBranches();
    };
  }, [profile]);

  // Close menu on click outside
  useEffect(() => {
      const handleClickOutside = () => setActiveMenu(null);
      if (activeMenu) {
          window.addEventListener('click', handleClickOutside);
      }
      return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  // Fetch Policies from Students
  useEffect(() => {
    if (!profile) return;
    
    let effectiveBranchIds: string[] = [];
    if (filterBranchId !== "All") {
        effectiveBranchIds = [filterBranchId];
    } else {
        effectiveBranchIds = []; // Both admin and superAdmin can see all
    }

    const unsubscribe = subscribeToStudents((students) => {
        const extractedPolicies = students
            .filter(s => s.insurance_info) // Only students with insurance
            .map(s => {
                const info = s.insurance_info!;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = new Date(info.end_date);
                endDate.setHours(0, 0, 0, 0);
                const isExpired = endDate <= today;
                
                return {
                    id: s.student_id,
                    studentId: s.student_code,
                    studentName: s.student_name,
                    policyNumber: info.policy_number,
                    provider: info.provider,
                    type: info.type,
                    startDate: info.start_date,
                    endDate: info.end_date,
                    coverageAmount: info.coverage_amount,
                    claimedAmount: (info.claims || [])
                        .filter(c => filterTermId === 'All' || c.term_id === filterTermId)
                        .reduce((sum, c) => sum + c.amount, 0),
                    totalClaimedAmount: info.claimed_amount || 0,
                    claimsCount: (info.claims || [])
                        .filter(c => filterTermId === 'All' || c.term_id === filterTermId).length,
                    claims: info.claims || [],
                    status: isExpired ? 'Inactive' : 'Active'
                };
            })
            .sort((a, b) => {
                if (a.status === 'Inactive' && b.status !== 'Inactive') return -1;
                if (a.status !== 'Inactive' && b.status === 'Inactive') return 1;
                return 0;
            });
        setPolicies(extractedPolicies);
        setLoading(false);
    }, effectiveBranchIds);
     return () => unsubscribe();
  }, [profile, filterTermId, filterBranchId]); 

  const activePolicies = policies.filter(p => p.status === 'Active');
  
  const stats = useMemo(() => ({
      total: policies.length,
      active: activePolicies.length,
      inactive: policies.filter(p => p.status === 'Inactive').length,
      claimed: policies.filter(p => p.claimsCount > 0).length,
      notClaimed: activePolicies.filter(p => p.claimsCount === 0).length,
  }), [policies, activePolicies]);

  const filteredTerms = terms.filter(t => filterBranchId === "All" || t.branch_id === filterBranchId);
  const filteredPolicies = policies.filter(p => {
      if (filter !== 'All' && p.status !== filter) return false;
      if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
              p.studentName.toLowerCase().includes(query) ||
              p.studentId.toLowerCase().includes(query) ||
              p.policyNumber.toLowerCase().includes(query) ||
              p.provider.toLowerCase().includes(query)
          );
      }
      return true;
  });

  const handleDeleteInsurance = async (studentId: string, studentName: string) => {
      if (profile?.role !== 'superAdmin') {
          alert("Only superAdmin can remove insurance records.");
          return;
      }
      if (window.confirm(`Are you sure you want to remove insurance for ${studentName}?`)) {
          try {
              const { doc, updateDoc, deleteField } = await import("firebase/firestore");
              const { db } = await import("@/lib/firebase");
              const docRef = doc(db, "students", studentId);
              await updateDoc(docRef, { insurance_info: deleteField() });
          } catch (error) {
              console.error("Error deleting insurance:", error);
              alert("Failed to remove insurance info.");
          }
      }
  };

  const openRenewModal = (policy: any) => {
      setSelectedStudentId(policy.id);
      setSelectedPolicyData({
          policyNumber: policy.policyNumber,
          startDate: policy.startDate,
          endDate: policy.endDate,
          coverageAmount: policy.coverageAmount,
          studentName: policy.studentName
      });
      setShowModal(true);
  };

  const openClaimModal = (policy: any) => {
      setClaimPolicy(policy);
      setShowClaimModal(true);
  };

  const openHistoryModal = (policy: any) => {
      setHistoryPolicy(policy);
      setShowHistoryModal(true);
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-in fade-in duration-700 w-full max-w-[1600px] mx-auto overflow-hidden px-4 md:px-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-5">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500 relative overflow-hidden group/header">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-0 group-hover/header:opacity-100 transition-opacity duration-500" />
                  <ShieldCheck size={24} className="md:size-7" />
              </div>
              <div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Insurance</h1>
                  <p className="text-slate-400 font-bold text-[10px] md:text-xs mt-0.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Centralized Policy Management
                  </p>
              </div>
          </div>
          <button 
              onClick={() => setShowModal(true)}
              className="group flex items-center justify-center gap-2 px-6 py-3.5 md:px-8 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-[1.25rem] font-black text-xs md:text-[13px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 w-full md:w-auto relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Plus size={18} className="md:size-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10 tracking-widest uppercase">Add Insurance</span>
          </button>
      </div>

       <AddInsuranceModal 
        isOpen={showModal}
        studentId={selectedStudentId}
        initialData={selectedPolicyData}
        onClose={() => {
            setShowModal(false);
            setSelectedStudentId(undefined);
            setSelectedPolicyData(undefined);
        }}
        onSuccess={() => {}}
      />

      {claimPolicy && (
          <ClaimInsuranceModal 
            isOpen={showClaimModal}
            studentId={claimPolicy.id}
            studentName={claimPolicy.studentName}
            coverageAmount={claimPolicy.coverageAmount}
            currentClaimed={claimPolicy.claimedAmount}
            onClose={() => {
                setShowClaimModal(false);
                setClaimPolicy(null);
            }}
            onSuccess={() => {}}
          />
      )}

      {historyPolicy && (
          <InsuranceClaimsHistoryModal
            isOpen={showHistoryModal}
            studentName={historyPolicy.studentName}
            claims={historyPolicy.claims || []}
            terms={terms}
            onClose={() => {
                setShowHistoryModal(false);
                setHistoryPolicy(null);
            }}
          />
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white/40 backdrop-blur-md p-4 md:p-5 rounded-2xl md:rounded-[1.5rem] border border-white/50 shadow-sm transition-all duration-300 relative z-30">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 md:gap-6">
             {/* Custom Rounded Search UI - Right Aligned Icon */}
             <div className="relative group w-full lg:max-w-[300px]">
                <input 
                    placeholder="Search students..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-5 pr-11 py-3 md:pl-6 md:pr-12 md:py-3.5 bg-white border border-slate-200 rounded-xl text-xs md:text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-400 shadow-sm relative z-0" 
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none z-10">
                    <Search className="text-slate-400 group-focus-within:text-indigo-600 transition-all" size={17} />
                </div>
             </div>

              <div className="flex items-center gap-2.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
                {/* Branch Filter */}
                <div className="relative min-w-[140px] md:min-w-[150px] group flex-1 md:flex-none">
                    <select 
                        value={filterBranchId}
                        onChange={(e) => {
                            setFilterBranchId(e.target.value);
                            setFilterTermId("All");
                        }}
                        className="w-full pl-3.5 pr-9 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer shadow-sm"
                    >
                        <option value="All">All Branches</option>
                        {branches.map(b => (
                            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown size={12} />
                    </div>
                </div>

                {/* Term Filter */}
                <div className="relative min-w-[140px] md:min-w-[150px] group flex-1 md:flex-none">
                   <select 
                       value={filterTermId}
                       onChange={(e) => setFilterTermId(e.target.value)}
                       className="w-full pl-3.5 pr-9 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer shadow-sm"
                   >
                       <option value="All">All Terms</option>
                       {filteredTerms.map(t => (
                           <option key={t.term_id} value={t.term_id}>{t.term_name}</option>
                       ))}
                   </select>
                   <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                       <ChevronDown size={12} />
                   </div>
                </div>
              </div>
          </div>
      </div>

      {/* Analytics Section - Matching Attendance Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-100 group transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4 opacity-80">
                   <DollarSign size={16} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Claimed</span>
              </div>
              <div className="text-4xl font-black mb-1">{stats.claimed}</div>
              <div className="text-[10px] font-bold opacity-60">Policy Claims</div>
          </div>

          <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-blue-50 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4 text-blue-500">
                   <Clock size={16} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ready</span>
              </div>
              <div className="text-4xl font-black text-slate-900 mb-1">{stats.notClaimed}</div>
              <div className="text-[10px] font-bold text-slate-400">Available to Claim</div>
          </div>

          <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-emerald-50 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4 text-emerald-500">
                   <ShieldCheck size={16} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active</span>
              </div>
              <div className="text-4xl font-black text-slate-900 mb-1">{stats.active}</div>
              <div className="text-[10px] font-bold text-slate-400">Valid Policies</div>
          </div>

          <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 shadow-sm group transition-all duration-300 hover:shadow-xl hover:shadow-rose-50 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4 text-rose-500">
                   <Eye size={16} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">History</span>
              </div>
              <div className="text-4xl font-black text-slate-900 mb-1">{stats.inactive}</div>
              <div className="text-[10px] font-bold text-slate-400">Expired Policies</div>
          </div>
      </div>

      {/* Policies Table - Redesigned to match Student Table */}
      <div className="bg-white rounded-xl md:rounded-[1.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 transition-colors">
                        <th className="px-6 py-4 w-12 sticky left-0 bg-slate-50/95 backdrop-blur-sm z-30">
                            <div className="flex items-center justify-center">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" readOnly />
                            </div>
                        </th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-left sticky left-12 bg-slate-50/95 backdrop-blur-sm z-30 border-r border-slate-100">Action</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-left">Insured Student</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-left">Policy Details</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Coverage</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center whitespace-nowrap">Usage</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Balance</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">History</th>
                        <th className="px-4 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center whitespace-nowrap">Expiration</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredPolicies.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="p-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">No policies found</td>
                        </tr>
                    ) : filteredPolicies.map((policy) => (
                        <tr key={policy.id} className="hover:bg-indigo-50/30 transition-all duration-300 group relative">
                            <td className="px-6 py-4 sticky left-0 bg-white/95 group-hover:bg-indigo-50/30 backdrop-blur-sm z-20">
                                <div className="flex items-center justify-center">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" readOnly />
                                </div>
                            </td>
                            <td className={`px-4 py-3 sticky left-12 bg-white/95 group-hover:bg-indigo-50/30 backdrop-blur-sm z-20 border-r border-slate-100 ${activeMenu === policy.id ? 'z-[60]' : ''}`}>
                                <div className="relative flex items-center group/action">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === policy.id ? null : policy.id); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-white transition-colors bg-slate-50 shadow-sm"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {activeMenu === policy.id && (
                                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 flex items-center gap-1 p-1.5 bg-white rounded-xl shadow-[0_15px_45px_-12px_rgba(0,0,0,0.25)] border border-slate-100 z-[100] animate-in fade-in zoom-in-95 duration-200">
                                            {[
                                                { icon: <DollarSign size={16} />, title: 'Record Claim', color: 'amber', onClick: () => openClaimModal(policy) },
                                                { icon: <Eye size={16} />, title: 'History', color: 'indigo', onClick: () => openHistoryModal(policy) },
                                                { icon: <Edit2 size={16} />, title: 'Renew Policy', color: 'indigo', onClick: () => openRenewModal(policy) },
                                                profile?.role === 'superAdmin' && { icon: <Trash2 size={16} />, title: 'Remove', color: 'rose', onClick: () => handleDeleteInsurance(policy.id, policy.studentName) }
                                            ].filter((action): action is any => !!action).map((action, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={(e) => { e.stopPropagation(); action.onClick(); setActiveMenu(null); }}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-${action.color}-50 hover:text-${action.color}-600 text-slate-500`}
                                                    title={action.title}
                                                >
                                                    {action.icon}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-3 min-w-[240px]">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100/80 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-200 uppercase shrink-0">
                                        {policy.studentName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{policy.studentName}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{policy.studentId}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">{policy.policyNumber}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="text-sm font-bold text-slate-700">${policy.coverageAmount?.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="text-sm font-black text-amber-600">${policy.claimedAmount?.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-100">
                                    ${(policy.coverageAmount - policy.totalClaimedAmount)?.toLocaleString()}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <button onClick={() => openHistoryModal(policy)} className="text-xs font-black text-indigo-600 hover:underline">
                                    {policy.claimsCount} Records
                                </button>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className={`text-xs font-bold ${policy.status === 'Inactive' ? 'text-rose-500' : 'text-slate-500'}`}>
                                    {policy.endDate}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-center">
                                <div className="flex justify-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                        policy.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${policy.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                        {policy.status}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
