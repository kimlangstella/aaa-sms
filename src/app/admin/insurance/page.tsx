"use client";

import { useState, useEffect } from "react";
import { PolicyCard } from "@/components/insurance/PolicyCard";
import { InsurancePolicy } from "@/types/insurance";
import { 
  ShieldCheck, 
  AlertCircle, 
  Users, 
  Plus, 
  Search, 
  Filter,
  Calendar
} from "lucide-react";

import { AddInsuranceModal } from "@/components/modals/AddInsuranceModal";
import { subscribeToStudents } from "@/lib/services/schoolService";
import { Student } from "@/lib/types";

export default function InsurancePage() {
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Policies from Students
  useEffect(() => {
    const unsubscribe = subscribeToStudents((students) => {
        const extractedPolicies = students
            .filter(s => s.insurance_info) // Only students with insurance
            .map(s => {
                const info = s.insurance_info!;
                
                // Fix: Normalize dates to compare without time
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const endDate = new Date(info.end_date);
                endDate.setHours(0, 0, 0, 0); // Normalize to start of day
                
                // User requirement: "expire top one is expired because it today"
                // So if endDate is today, it is expired.
                const isExpired = endDate <= today;
                
                const thirtyDaysFromNow = new Date(today);
                thirtyDaysFromNow.setDate(today.getDate() + 30);

                // Expiring soon if active but ends within 30 days
                const isExpiringSoon = !isExpired && endDate <= thirtyDaysFromNow;

                return {
                    id: s.student_id, // Use student ID as key for now
                    studentId: s.student_code,
                    studentName: s.student_name,
                    policyNumber: info.policy_number,
                    provider: info.provider,
                    type: info.type,
                    startDate: info.start_date,
                    endDate: info.end_date,
                    coverageAmount: info.coverage_amount,
                    status: isExpired ? 'Inactive' : 'Active'
                };
            })
            .sort((a, b) => {
                // Sort Inactive first
                if (a.status === 'Inactive' && b.status !== 'Inactive') return -1;
                if (a.status !== 'Inactive' && b.status === 'Inactive') return 1;
                return 0; // Keep original order otherwise
            });
        setPolicies(extractedPolicies);
        setLoading(false);
    });

    return () => unsubscribe();
  }); 

  const filteredPolicies = policies.filter(p => {
      // Step 1: Filter by Status Tab
      if (filter !== 'All' && p.status !== filter) return false;

      // Step 2: Filter by Search Query
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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500">
                  <ShieldCheck size={24} />
              </div>
              <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Insurance </h1>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Insurance Management</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{policies.length} Active Insurance</span>
                  </div>
              </div>
          </div>
          <button 
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 w-full md:w-auto"
          >
            <Plus size={20} />
            <span>Protect New Student</span>
          </button>
      </div>

      <AddInsuranceModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
            // Data updates automatically via subscription
        }}
      />

      {/* Filter & Search Bar */}
      <div className="bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border border-white/50 shadow-sm transition-all duration-300">
          <div className="flex flex-col md:flex-row items-center gap-6">
             {/* Custom Rounded Search UI */}
             <div className="relative group flex-1 w-full md:max-w-[300px]">
                <input 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-6 pr-12 py-3.5 bg-white border border-slate-200 rounded-[1.25rem] text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400 shadow-sm" 
                />
                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                    <Search className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                </div>
             </div>

             {/* Filter Tabs */}
             <div className="flex bg-slate-100/50 p-1.5 rounded-[1.25rem] border border-slate-200/30 w-full md:w-auto">
                {['All', 'Active', 'Inactive'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all
                            ${filter === tab 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white'
                            }
                        `}
                    >
                        {tab === 'All' ? 'All Insurance' : tab}
                    </button>
                ))}
             </div>
          </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 uppercase tracking-widest text-[9px] font-black text-slate-400">
                        <th className="px-8 py-4">Insured Student</th>
                        <th className="px-8 py-4">Insurance Identifier</th>
                        <th className="px-8 py-4 text-center">Expired Date</th>
                        <th className="px-8 py-4 text-center">Current Status</th>
                        <th className="px-8 py-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                    {filteredPolicies.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <ShieldCheck className="text-slate-200" size={48} />
                                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No matching portfolios found</p>
                                </div>
                            </td>
                        </tr>
                    ) : filteredPolicies.map((policy) => (
                        <tr key={policy.id} className="group hover:bg-white/80 transition-all duration-300">
                             <td className="px-8 py-4">
                                 <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all group-hover:rotate-6">
                                         {policy.studentName.charAt(0)}
                                     </div>
                                     <div>
                                         <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-[13px] tracking-tight">{policy.studentName}</p>
                                         <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{policy.studentId}</p>
                                     </div>
                                 </div>
                             </td>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <ShieldCheck size={14} />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-700 text-xs tracking-tight">{policy.policyNumber}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{policy.provider}</p>
                                    </div>
                                </div>
                             </td>
                             <td className="px-8 py-4 text-center">
                                 <div className="flex flex-col items-center gap-1">
                                     <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 uppercase tracking-tight bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                         <Calendar size={12} className="text-rose-400" />
                                         <span>{policy.endDate}</span>
                                     </div>
                                 </div>
                             </td>
                             <td className="px-8 py-4">
                                 <div className="flex justify-center">
                                     <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm ${
                                         policy.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-50' : 
                                         policy.status === 'Inactive' ? 'bg-rose-50 text-rose-500 border-rose-100 shadow-rose-50' :
                                         'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-50'
                                     }`}>
                                         {policy.status}
                                     </span>
                                 </div>
                             </td>
                             <td className="px-8 py-4 text-right">
                                 <div className="flex items-center justify-end gap-1.5">
                                     <button className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white transition-all border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-md" title="View Details">
                                         <Search size={15} />
                                     </button>
                                     <button className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-white transition-all border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md" title="Edit Portfolio">
                                         <Filter size={15} /> 
                                     </button>
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

function StatsCard({ title, value, trend, icon, color }: any) {
    return (
        <div className={`p-6 rounded-2xl border ${color} transition-all hover:-translate-y-1 hover:shadow-lg`}>
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                    {icon}
                </div>
                {trend && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/50 text-slate-600 border border-slate-200/50">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">{title}</p>
                <h3 className="text-3xl font-black text-slate-800 mt-1">{value}</h3>
            </div>
        </div>
    )
}
