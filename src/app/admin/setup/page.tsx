"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Building2, 
  GraduationCap, 
  Landmark, 
  Plus, 
  School, 
  BookOpen, 
  Calendar, 
  Settings, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Save, 
  Loader2, 
  Users,
  MoreVertical,
  Check,
  Camera,
  X,
  Edit,
  ChevronDown,
  Trash2,
  Clock,
  Layers,
} from "lucide-react";
import { 
  getSchoolDetails, 
  updateSchoolDetails, 
  createSchoolDetails, 
  subscribeToSchoolDetails, 
  subscribeToClasses, 
  subscribeToStudents, 
  subscribeToEnrollments,
  uploadImage 
} from "@/lib/services/schoolService";
import { branchService } from "@/services/branchService";
import { programService } from "@/services/programService";
import { inventoryService } from "@/services/inventoryService";
import { School as SchoolType, Branch, Class, Enrollment, InventoryItem } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="h-96 flex justify-center items-center"><Loader2 className="animate-spin text-blue-600" size={48} /></div>}>
        <SetupContent />
    </Suspense>
  );
}

function SetupContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as string;
  
  const [activeTab, setActiveTab] = useState(tabParam || 'branches');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [editingBranch, setEditingBranch] = useState<any>(null); // State for editing branch
  const [school, setSchool] = useState<SchoolType | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // Sticky state for the form
  const [lastSelectedBranch, setLastSelectedBranch] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    
    const branchIds: string[] = []; // Fetch all data regardless of role (admin/superAdmin)

    const unsubSchool = subscribeToSchoolDetails(setSchool);
    const unsubBranches = branchService.subscribe(setBranches, branchIds);
    const unsubClasses = subscribeToClasses(setClasses, branchIds);
    const unsubEnrollments = subscribeToEnrollments(setEnrollments, branchIds);
    const unsubInventory = inventoryService.subscribe(setInventoryItems, branchIds);
    return () => {
        unsubSchool();
        unsubBranches();
        unsubClasses();
        unsubEnrollments();
        unsubInventory();
    };
  }, [profile]);

  useEffect(() => {
    if (!searchParams.get('tab')) {
        router.replace('/admin/setup?tab=branches', { scroll: false });
    } else if (tabParam !== activeTab) {
        setActiveTab(tabParam);
    }
  }, [searchParams, activeTab, router, tabParam]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setShowAddForm(false);
    setEditingProgram(null); // Clear edit state
    router.push(`/admin/setup?tab=${tab}`, { scroll: false });
  };

  const hasSchool = !!school?.school_id;
  const hasBranches = branches.length > 0;

  return (
    <div className="max-w-[1800px] mx-auto space-y-8 pb-20 px-4 xl:px-0">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-4">
          <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 animate-in zoom-in-95 duration-500">
                  <Settings size={24} />
              </div>
              <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Configuration</h1>

              </div>
          </div>
          
          <div className="bg-white/60 backdrop-blur-md p-1.5 rounded-[1.5rem] flex items-center shadow-sm border border-slate-200/50 w-full lg:w-auto overflow-x-auto custom-scrollbar">
             <TabButton 
                active={activeTab === 'branches'} 
                onClick={() => handleTabChange('branches')} 
                icon={<Building2 size={18} />} 
                label="Branches" 
             />
             <TabButton 
                active={activeTab === 'programs'} 
                onClick={() => handleTabChange('programs')} 
                icon={<GraduationCap size={18} />} 
                label="Programs" 
                disabled={!hasBranches}
             />
             <TabButton 
                active={activeTab === 'identity'} 
                onClick={() => handleTabChange('identity')} 
                icon={<Landmark size={18} />} 
                label="School Identity" 
             />
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'branches' && (
              <div className="space-y-6">
                   {!hasSchool ? (
                       <SetupRequired message="Please configure your School Identity first." action={() => handleTabChange('identity')} />
                   ) : (showAddForm || editingBranch) ? (
                       <div className="max-w-3xl mx-auto">
                            <CreateBranchForm 
                               school={school} 
                               initialData={editingBranch}
                               onCancel={() => {
                                   setShowAddForm(false);
                                   setEditingBranch(null);
                               }} 
                            />
                       </div>
                   ) : (
                       <BranchList 
                            branches={branches} 
                            enrollments={enrollments} 
                            onAdd={() => setShowAddForm(true)} 
                            onEdit={(branch: any) => setEditingBranch(branch)}
                            onDelete={async (id: string) => {
                                if (confirm("Are you sure you want to delete this branch? This action cannot be undone.")) {
                                    try {
                                        await branchService.delete(id);
                                    } catch (e) {
                                        console.error(e);
                                        alert("Failed to delete branch");
                                    }
                                }
                            }}
                            role={profile?.role}
                       />
                   )}
              </div>
          )}

          {activeTab === 'programs' && (
              <div className="space-y-6">
                  {!hasBranches ? (
                       <SetupRequired message="Please create at least one Branch first." action={() => handleTabChange('branches')} />
                   ) : (showAddForm || editingProgram) ? (
                       <div className="max-w-3xl mx-auto">
                            <ProgramForm 
                                 branches={branches} 
                                 initialData={editingProgram}
                                 onCancel={() => {
                                     setShowAddForm(false);
                                     setEditingProgram(null);
                                 }} 
                                 lastSelectedBranch={lastSelectedBranch}
                                 setLastSelectedBranch={setLastSelectedBranch}
                                 inventoryItems={inventoryItems}
                                 role={profile?.role}
                            />
                       </div>
                   ) : (
                       <ProgramList 
                            branches={branches}
                            classes={classes} 
                            enrollments={enrollments} 
                            inventoryItems={inventoryItems}
                            onAdd={() => setShowAddForm(true)}
                            onEdit={(program: any) => setEditingProgram(program)}
                            onDelete={async (id: string) => {
                                try {
                                    await programService.delete(id);
                                } catch (e) {
                                    console.error(e);
                                    alert("Failed to delete program");
                                }
                            }}
                            role={profile?.role}
                       />
                   )}
              </div>
          )}

          {activeTab === 'identity' && (
               <div className="max-w-4xl mx-auto">
                    <SchoolSettingsForm school={school} />
               </div>
          )}
      </div>
    </div>
  );
}

// --- Components ---

function TabButton({ active, onClick, icon, label, disabled }: any) {
    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.125rem] font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${
                active 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' 
                : disabled 
                ? 'text-slate-300 cursor-not-allowed opacity-50'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-white'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function SetupRequired({ message, action }: { message: string, action: () => void }) {
    return (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2">
                <Landmark size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Setup Required</h3>
            <p className="text-slate-500 font-medium">{message}</p>
            <button onClick={action} className="mt-4 text-blue-600 font-bold hover:underline">
                Go to configuration &rarr;
            </button>
        </div>
    );
}

// --- Forms & Lists ---

function BranchList({ branches, enrollments, onAdd, onEdit, onDelete, role }: any) {
    const uniqueBranches = Array.from(new Map((branches || []).map((b: any) => [b.branch_id, b])).values());
    
    return (
        <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-sm overflow-hidden">
             <div className="px-8 py-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Building2 size={24} />
                    </div>
                    <div>
                         <h2 className="text-xl font-black text-slate-800 tracking-tight">Branch Campuses</h2>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Locations</p>
                    </div>
                </div>
                <button onClick={onAdd} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.25rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 w-full sm:w-auto justify-center active:scale-95">
                    <Plus size={20} />
                    <span>Create Branch</span>
                </button>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[800px]">
                     <thead>
                         <tr className="bg-slate-50/50 border-b border-slate-100">
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Name</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Contact</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Address</th>
                             <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Enrollment</th>
                             <th className="px-8 py-4 text-right pr-12 text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                          {uniqueBranches.length === 0 ? (
                              <tr>
                                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">No branches registered yet.</td>
                              </tr>
                          ) : uniqueBranches.map((b: any) => (
                              <tr key={b.branch_id} className="hover:bg-blue-50/30 transition-colors group">
                                  <td className="px-8 py-5 font-bold text-slate-700">{b.branch_name}</td>
                                  <td className="px-8 py-5 text-sm text-slate-500">{b.phone}</td>
                                  <td className="px-8 py-5 text-sm text-slate-500 max-w-xs truncate">{b.address}</td>
                                  <td className="px-8 py-5 text-center">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                          {/* Placeholder count logic since strict mapping is complex in pure view */}
                                          {enrollments?.length > 0 ? 'Active' : '0'} 
                                      </span>
                                  </td>
                                  <td className="px-8 py-5 text-right pr-8">
                                      <div className="flex items-center justify-end gap-1 transition-all duration-300">
                                          <button 
                                              onClick={() => onEdit(b)}
                                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                              title="Edit Branch"
                                          >
                                              <Edit size={16} />
                                          </button>
                                          {role === 'superAdmin' && (
                                              <button 
                                                  onClick={() => onDelete(b.branch_id)}
                                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                  title="Delete Branch"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                     </tbody>
                 </table>
            </div>
        </div>
    )
}

function ProgramList({ branches, classes, enrollments, inventoryItems, onAdd, onEdit, onDelete, role }: any) {
    const [programs, setPrograms] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");

    useEffect(() => {
        const unsubscribe = programService.subscribe(setPrograms);
        return () => unsubscribe();
    }, []);

    const filteredPrograms = programs.filter(p => !selectedBranch || p.branchId === selectedBranch);
    const uniqueBranches = Array.from(new Map((branches || []).map((b: any) => [b.branch_id, b])).values());

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Academic Programs</h2>
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest text-[10px] mt-1">Curriculum and fee structures</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group w-full sm:w-64">
                        <select 
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer appearance-none pr-10"
                        >
                            <option value="">All Branches</option>
                            {uniqueBranches.map((b: any) => (
                                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronDown size={16} />
                        </div>
                    </div>

                    <button onClick={onAdd} className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 w-full sm:w-auto justify-center active:scale-95">
                        <Plus size={18} />
                        <span>New Program</span>
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-slate-50/30">
                 {filteredPrograms.length === 0 ? (
                      <div className="col-span-full py-20 text-center space-y-4">
                           <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto">
                                <BookOpen size={32} />
                           </div>
                           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No programs found matching filters</p>
                      </div>
                 ) : (
                      (() => {
                      const grouped: { [key: string]: any[] } = {};
                      filteredPrograms.forEach(p => {
                           const key = `${p.name}-${p.price}`;
                           if (!grouped[key]) grouped[key] = [];
                           grouped[key].push(p);
                       });

                      return Object.values(grouped).map((group: any[]) => {
                          const p = group[0];
                          const branchIds = Array.from(new Set(group.map(i => i.branchId)));

                          return (
                              <div key={`${p.name}-${p.id}`} className="bg-white p-6 rounded-3xl border-2 border-slate-50 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300 group animate-in zoom-in-95 duration-500 relative">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                                          <GraduationCap size={20} className="font-bold text-indigo-500 group-hover:text-white" />
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                          <button 
                                              onClick={() => onEdit({ ...p, allBranchIds: branchIds })}
                                              className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                              title="Edit Program"
                                          >
                                              <Edit size={16} />
                                          </button>
                                          {role === 'superAdmin' && (
                                              <button 
                                                  onClick={() => {
                                                      if (confirm(`Are you sure you want to delete "${p.name}" from all ${group.length} branches?`)) {
                                                          group.forEach(i => onDelete(i.id));
                                                      }
                                                  }}
                                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                  title="Delete from all branches"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          )}
                                      </div>
                                  </div>

                                  <div className="space-y-1 mb-4">
                                      <div className="flex justify-between items-center">
                                          <h3 className="text-lg font-black text-slate-800 tracking-tight">{p.name}</h3>
                                          {(!p.variants || p.variants.length === 0) && (
                                              <span className="text-xl font-black text-slate-900">${p.price}</span>
                                          )}
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-1 mt-2">
                                          {branchIds.map(id => {
                                              const branch = uniqueBranches.find((b: any) => b.branch_id.toString() === id?.toString()) as any;
                                              return (
                                                  <span key={`${p.name}-${id}`} className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest border border-slate-100">
                                                      {branch?.branch_name || '??'}
                                                  </span>
                                              );
                                          })}
                                      </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                            <Calendar size={12} className="text-indigo-400" />
                                            <span>{p.durationSessions} Sessions</span>
                                      </div>
                                      {(() => {
                                          if (p.variants && p.variants.length > 0) return null;
                                          const fee = p.session_fee || (p.price && p.durationSessions ? (Number(p.price) / Number(p.durationSessions)).toFixed(2) : null);
                                          return fee ? (
                                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest leading-none">
                                                  <span>${fee}/S</span>
                                              </div>
                                          ) : null;
                                      })()}
                                      {p.needs_inventory && (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest" title="Needs Uniforms/Books">
                                              <span>Mats</span>
                                          </div>
                                      )}
                                  </div>

                                  {p.variants?.length > 0 && (
                                      <div className="mt-4 pt-4 border-t border-slate-50">
                                          <div className="flex flex-wrap gap-2">
                                              {Array.from(new Map((p.variants || []).map((v: any) => [v.id, v])).values()).slice(0, 3).map((v: any, vIdx: number) => (
                                                  <span key={`${v.id}-${vIdx}`} className="px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-500 text-[10px] font-bold border border-indigo-100/50">
                                                      {v.label} {v.time ? `(${v.time})` : ''}
                                                  </span>
                                              ))}
                                              {p.variants.length > 3 && (
                                                  <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[10px] font-bold">
                                                      +{p.variants.length - 3} more
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          );
                      });
                      })()
                 )}

                  <button onClick={onAdd} className="bg-white p-6 rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all min-h-[160px] group">
                       <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-100 flex items-center justify-center mb-3 group-hover:border-indigo-300 transition-colors">
                           <Plus size={24} />
                       </div>
                       <span className="font-black text-[10px] uppercase tracking-widest">Add Program</span>
                  </button>
            </div>
        </div>
    )
}

function ProgramForm({ branches, initialData, onCancel, lastSelectedBranch, setLastSelectedBranch, inventoryItems, role }: any) {
    const uniqueBranches = Array.from(new Map((branches || []).map((b: any) => [b.branch_id, b])).values());
    const [submitting, setSubmitting] = useState(false);
    const [needsInventory, setNeedsInventory] = useState(initialData?.needs_inventory || false);
    const [addons, setAddons] = useState<any[]>([]);
    const [variants, setVariants] = useState<any[]>(initialData?.variants || []);
    const [deletedAddonIds, setDeletedAddonIds] = useState<string[]>([]);
    const [programName, setProgramName] = useState(initialData?.name || "");
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
        initialData?.allBranchIds ? initialData.allBranchIds : (initialData?.branchId ? [initialData.branchId.toString()] : (lastSelectedBranch ? [lastSelectedBranch] : (uniqueBranches.length > 0 ? [(uniqueBranches[0] as any).branch_id] : [])))
    );

    useEffect(() => {
        if (initialData?.id) {
            import("@/services/programAddonService").then(({ getProgramAddons }) => {
                getProgramAddons(initialData.id).then(fetched => {
                    setAddons(fetched);
                });
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (!initialData) {
            const lowerName = programName.toLowerCase();
            const needsIt = ['taekwondo', 'music', 'ballet', 'robamkmer', 'chinese'].some(keyword => lowerName.includes(keyword));
            if (needsIt && addons.length === 0) {
                // Auto-add an empty slot instead of setting a simple boolean
                setAddons([{ itemId: '', type: 'inventory', defaultQty: 1, isOptional: true, isRecommended: false }]);
            }
        }
    }, [programName, initialData]);

    const handleToggleItem = () => {
        setAddons([...addons, { itemId: '', type: 'inventory', defaultQty: 1, isOptional: true, isRecommended: false }]);
    };

    const handleRemoveItem = (index: number) => {
        const addonToRemove = addons[index];
        if (addonToRemove?.id) {
            setDeletedAddonIds([...deletedAddonIds, addonToRemove.id]);
        }
        setAddons(addons.filter((_, i) => i !== index));
    };

    const handleAddonUpdate = (index: number, updates: any) => {
        const newAddons = [...addons];
        newAddons[index] = { ...newAddons[index], ...updates };
        setAddons(newAddons);
    };

    const handleAddVariant = () => {
        setVariants([...variants, { id: Date.now().toString(), label: '', price: 0 }]);
    };

    const handleRemoveVariant = (index: number) => {
        setVariants(variants.filter((_, i) => i !== index));
    };

    const handleVariantUpdate = (index: number, updates: any) => {
        const newVariants = [...variants];
        newVariants[index] = { ...newVariants[index], ...updates };
        setVariants(newVariants);
    };

    // Matrix Logic
    const COMMON_DURATIONS = ["30mn", "45mn", "1h", "1.5h", "2h"];
    
    // Group variants by label for the matrix view
    const [groups, setGroups] = useState<any[]>(() => {
        const initialGroups: any[] = [];
        const vars = initialData?.variants || [];
        const map = new Map();
        
        vars.forEach((v: any) => {
            if (!map.has(v.label)) map.set(v.label, []);
            map.get(v.label).push(v);
        });
        
        map.forEach((items, label) => {
            initialGroups.push({
                id: Date.now() + Math.random(),
                name: label,
                options: items.map((i: any) => ({ time: i.time, price: i.price }))
            });
        });
        
        return initialGroups;
    });

    const handleAddGroup = () => {
        setGroups([...groups, { id: Date.now(), name: "", options: [] }]);
    };

    const handleRemoveGroup = (groupId: any) => {
        setGroups(groups.filter(g => g.id !== groupId));
    };

    const updateGroupName = (groupId: any, name: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, name } : g));
    };

    const toggleOption = (groupId: any, time: string) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                const exists = g.options.find((o: any) => o.time === time);
                if (exists) {
                    return { ...g, options: g.options.filter((o: any) => o.time !== time) };
                } else {
                    return { ...g, options: [...g.options, { time, price: 0 }] };
                }
            }
            return g;
        }));
    };

    const updateOptionPrice = (groupId: any, time: string, price: any) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    options: g.options.map((o: any) => o.time === time ? { ...o, price } : o)
                };
            }
            return g;
        }));
    };

    const [formState, setFormState] = useState({
        price: initialData?.price || "",
        durationSessions: initialData?.durationSessions || 11,
        session_fee: initialData?.session_fee || ""
    });

    const handlePriceOrSessionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'price' || name === 'durationSessions') {
                const price = Number(name === 'price' ? value : prev.price);
                const sessions = Number(name === 'durationSessions' ? value : prev.durationSessions);
                if (price > 0 && sessions > 0) {
                    newState.session_fee = (price / sessions).toFixed(2);
                }
            }
            return newState;
        });
    };

    const toggleBranch = (branchId: string) => {
        // If editing, always keep the initial branch selected
        if (initialData && branchId === initialData.branchId.toString()) return;

        if (selectedBranchIds.includes(branchId)) {
            setSelectedBranchIds(selectedBranchIds.filter(id => id !== branchId));
        } else {
            setSelectedBranchIds([...selectedBranchIds, branchId]);
        }
    };

    const selectAllBranches = () => {
        if (selectedBranchIds.length === uniqueBranches.length) {
            // If editing, keep the initial branch
            setSelectedBranchIds(initialData ? [initialData.branchId.toString()] : []);
        } else {
            setSelectedBranchIds(uniqueBranches.map((b: any) => b.branch_id.toString()));
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(formData);
            
            // Clean up empty addons
            const validAddons = addons.filter(a => a.itemId);
            const hasAddons = validAddons.length > 0;
            
            // Convert Matrix Groups back to Variants
            const matrixVariants: any[] = [];
            groups.forEach(g => {
                if (g.name) {
                    g.options.forEach((opt: any) => {
                        matrixVariants.push({
                            id: `${g.name}-${opt.time}-${Date.now()}`,
                            label: g.name,
                            time: opt.time,
                            price: Number(opt.price)
                        });
                    });
                }
            });

            data.needs_inventory = hasAddons;
            data.inventoryItemIds = hasAddons ? validAddons.map(a => a.itemId) : [];
            data.variants = matrixVariants.length > 0 ? matrixVariants : variants.filter(v => v.label && v.price > 0);
            
            // Save sticky branch
            if (setLastSelectedBranch && selectedBranchIds.length > 0) {
                setLastSelectedBranch(selectedBranchIds[0]);
            }

            let programId = initialData?.id;

            if (initialData) {
                // Update the current program
                await programService.update(initialData.id, data);
                
                // Create for any NEWLY selected branches (Cloning)
                const newBranches = selectedBranchIds.filter(id => id !== initialData.branchId.toString());
                if (newBranches.length > 0) {
                    const cloningPromises = newBranches.map(async branchId => {
                        const branchData = { ...data, branchId };
                        return programService.create(branchData);
                    });
                    await Promise.all(cloningPromises);
                }
            } else {
                // Create for each selected branch
                const creationPromises = selectedBranchIds.map(async branchId => {
                    const branchData = { ...data, branchId };
                    const newProgramId = await programService.create(branchData);
                    // If this is the first program being created, use its ID for addon sync
                    if (!programId) programId = newProgramId;
                    return newProgramId;
                });
                await Promise.all(creationPromises);
            }

            // Sync Addons
            const { addProgramAddon, updateProgramAddon, deleteProgramAddon } = await import("@/services/programAddonService");
            
            // Process deletes
            for (const id of deletedAddonIds) {
                await deleteProgramAddon(id);
            }
            // If they removed all addons from a previously dirty state
            if (!hasAddons && initialData) {
                for (const addon of addons) {
                    if (addon.id) await deleteProgramAddon(addon.id);
                }
            }
            
            if (hasAddons) {
                // Process adds / updates
                for (let i = 0; i < validAddons.length; i++) {
                    const addon = validAddons[i];
                    addon.sortOrder = i; 
                    if (addon.id) {
                        await updateProgramAddon(addon.id, addon);
                    } else {
                        // Ensure programId is available for new addons
                        if (programId) {
                            await addProgramAddon({ ...addon, programId } as any);
                        } else {
                            console.warn("Program ID not available for new addon creation.");
                        }
                    }
                }
            }

            onCancel();
        } catch (error) {
            console.error(error);
            alert("Failed to save program");
        } finally {
            setSubmitting(false);
        }
    }
    
    return (
        <CardForm 
            title={initialData ? "Edit Academic Program" : "New Academic Program"} 
            onCancel={onCancel} 
            onSubmit={handleSubmit} 
            submitLabel={submitting ? (<Loader2 className="animate-spin" />) : (initialData ? "Update" : "Create")}
        >
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3 sm:col-span-2">
                      <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {initialData ? 'Clone to Other Branches' : 'Available in Branches'}
                          </label>
                          <button 
                              type="button" 
                              onClick={selectAllBranches}
                              className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                          >
                              {selectedBranchIds.length === uniqueBranches.length ? 'Deselect All' : 'Select All Branches'}
                          </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {uniqueBranches.map((b: any) => {
                              const isInitial = initialData && b.branch_id.toString() === initialData.branchId.toString();
                              return (
                                  <div 
                                      key={b.branch_id}
                                      onClick={() => toggleBranch(b.branch_id.toString())}
                                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-2 group ${
                                          selectedBranchIds.includes(b.branch_id.toString())
                                              ? 'border-indigo-500 bg-indigo-50/30' 
                                              : 'border-slate-50 bg-slate-50 opacity-60 hover:opacity-100 hover:border-slate-200'
                                      } ${isInitial ? 'cursor-default' : ''}`}
                                  >
                                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                          selectedBranchIds.includes(b.branch_id.toString()) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'
                                      }`}>
                                          {selectedBranchIds.includes(b.branch_id.toString()) && <div className="w-1.5 h-1.5 rounded-full bg-white animate-in zoom-in-50 duration-200" />}
                                      </div>
                                      <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${selectedBranchIds.includes(b.branch_id.toString()) ? 'text-indigo-600' : 'text-slate-500'}`}>
                                          {b.branch_name}
                                          {isInitial && <span className="ml-1 text-[8px] opacity-70">(Current)</span>}
                                      </span>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
                 <InputGroup 
                    label="Program Name" 
                    name="name" 
                    required 
                    placeholder="e.g. General English" 
                    defaultValue={initialData?.name}                     onChange={(e: any) => setProgramName(e.target.value)}
                    className="sm:col-span-1"
                  />
                  <InputGroup 
                    label="Sessions" 
                    name="durationSessions" 
                    type="number" 
                    required 
                    defaultValue={formState.durationSessions} 
                    onChange={handlePriceOrSessionsChange}
                  />
                   <div className={`grid grid-cols-2 gap-4 transition-all duration-500 overflow-hidden ${groups.length > 0 ? 'max-h-0 opacity-0 mb-0' : 'max-h-40 opacity-100 mb-6'}`}>
                     <InputGroup 
                        label="Tuition Fee ($)" 
                        name="price" 
                        type="number" 
                        placeholder="Total" 
                        defaultValue={formState.price} 
                        step="0.01" 
                        onChange={handlePriceOrSessionsChange}
                     />
                     <InputGroup 
                        label="Session Fee ($)" 
                        name="session_fee" 
                        type="number" 
                        placeholder="Fee per session" 
                        key={formState.session_fee} // Key forces input refresh when auto-calculated
                        defaultValue={formState.session_fee} 
                        step="0.01" 
                     />
                  </div>
               </div>

                {/* Sub-Programs Matrix View */}
                <div className="mt-10 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-800 tracking-tight">Multi-Option Setup</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Programs & durations</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={handleAddGroup}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-100"
                        >
                            <Plus size={14} />
                            <span>Add Program</span>
                        </button>
                    </div>

                    {groups.length === 0 ? (
                        <div 
                            onClick={handleAddGroup}
                            className="py-12 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer group"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                <Layers size={20} />
                            </div>
                            <p className="text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">Click to add Sub-Programs (e.g. Guitar, Piano)</p>
                            <p className="text-[10px] font-medium text-slate-300 mt-1">Easily select multiple durations and prices for each program</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 space-y-6 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all animate-in slide-in-from-bottom-2 duration-300 relative group/card">
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveGroup(group.id)}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                        {/* Program Name */}
                                        <div className="lg:col-span-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Program Name</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Guitar"
                                                value={group.name}
                                                onChange={(e) => updateGroupName(group.id, e.target.value)}
                                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all"
                                            />
                                        </div>

                                        {/* Durations Matrix */}
                                        <div className="lg:col-span-8 space-y-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Toggle Durations & Set Prices</label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {COMMON_DURATIONS.map(time => {
                                                    const option = group.options.find((o: any) => o.time === time);
                                                    return (
                                                        <div 
                                                            key={time}
                                                            className={`p-1 rounded-2xl transition-all border-2 ${
                                                                option ? 'border-indigo-500 bg-white shadow-sm' : 'border-slate-50 bg-slate-50/50 grayscale'
                                                            }`}
                                                        >
                                                            <div 
                                                                onClick={() => toggleOption(group.id, time)}
                                                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-between ${
                                                                    option ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                            >
                                                                <span>{time}</span>
                                                                {option && <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center"><Plus size={10} className="text-white rotate-45" /></div>}
                                                            </div>
                                                            
                                                            {option && (
                                                                <div className="px-3 pb-3 pt-1 border-t border-slate-50 mt-1 animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="relative">
                                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">$</span>
                                                                        <input 
                                                                            type="number"
                                                                            step="0.01"
                                                                            placeholder="Price"
                                                                            value={option.price || ""}
                                                                            onChange={(e) => updateOptionPrice(group.id, time, e.target.value)}
                                                                            className="w-full pl-4 py-1.5 bg-transparent outline-none text-sm font-black text-slate-700"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
          </CardForm>
     )
 }

function SchoolSettingsForm({ school }: any) {
    const [submitting, setSubmitting] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        try {
            let logoUrl = school?.logo_url;
            if (logoFile) {
                logoUrl = await uploadImage(logoFile, `school/logo_${Date.now()}`);
            }

            const data: any = {
                school_name: formData.get("school_name"),
                website: formData.get("website"),
                address: formData.get("address"),
                contact_info: formData.get("contact_info"),
                email: formData.get("email"),
                logo_url: logoUrl
            };

            if (school?.school_id) await updateSchoolDetails(school.school_id, data);
            else await createSchoolDetails(data);
            
            // Clear file state after successful save
            setLogoFile(null);
        } catch (error) {
            console.error(error);
            alert("Failed to save settings");
        } finally {
            setSubmitting(false);
        }
    }

    return (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             {/* Left Side: Edit Form */}
             <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                 <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                     <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Update Profile</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Required * Optional</p>
                     </div>
                 </div>
                 
                 <form onSubmit={handleSubmit} className="p-8 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="relative p-6 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group overflow-hidden">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleLogoChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                />
                                {logoPreview || school?.logo_url ? (
                                    <img src={logoPreview || school.logo_url} alt="Logo" className="w-16 h-16 rounded-full object-cover mb-2 ring-4 ring-white shadow-md transform group-hover:scale-110 transition-transform" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <School size={28} />
                                    </div>
                                )}
                                <span className="text-xs font-bold text-blue-600">
                                    {logoPreview || school?.logo_url ? 'Change Logo' : 'Upload Logo'}
                                </span>
                           </div>
                           <div className="space-y-6">
                                <InputGroup label="Phone Number" name="contact_info" defaultValue={school?.contact_info} required />
                                <InputGroup label="Website URL" name="website" defaultValue={school?.website} />
                           </div>
                           
                           <InputGroup label="Name of Institute" name="school_name" defaultValue={school?.school_name} required className="sm:col-span-1" />
                           <InputGroup label="Address" name="address" defaultValue={school?.address} required className="sm:col-span-1" />
                           
                           <InputGroup label="Institutional Email" name="email" defaultValue={school?.email} required className="sm:col-span-2" />
                      </div>
                      
                      <div className="flex justify-end pt-2">
                           <button disabled={submitting} className="px-8 py-3 bg-orange-400 text-white rounded-xl font-bold text-sm hover:bg-orange-500 transition-all shadow-lg shadow-orange-100 disabled:opacity-50">
                               {submitting ? 'Saving...' : 'Update Profile'}
                           </button>
                      </div>
                 </form>
             </div>

             {/* Right Side: Profile Preview */}
             <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden p-8 flex flex-col items-center text-center relative">
                 <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-full">
                     Profile View
                 </div>
                 
                <div className="mt-8 mb-6 relative group">
                    <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-xl shadow-slate-200 border-4 border-slate-50 ring-1 ring-slate-100 overflow-hidden relative">
                         {logoPreview || school?.logo_url ? (
                             <img src={logoPreview || school.logo_url} alt="School Logo" className="w-full h-full object-cover" />
                         ) : school?.school_name ? (
                             <span className="text-3xl font-black uppercase">{school.school_name.charAt(0)}</span>
                         ) : (
                             <School size={48} />
                         )}
                         
                         {/* Hidden Input Trigger Overlay */}
                         <div 
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                         >
                            <Camera size={24} className="text-white" />
                         </div>
                    </div>
                </div>

                 <h2 className="text-xl font-black text-slate-800 leading-tight mb-1">
                     {school?.school_name || "Your Institute Name"}
                 </h2>
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">
                     Institute Target Line
                 </p>

                 <div className="w-full space-y-4 text-left">
                     <PreviewItem icon={<Phone size={14} />} label="Phone No" value={school?.contact_info} />
                     <PreviewItem icon={<Mail size={14} />} label="Email" value={school?.email} />
                     <PreviewItem icon={<Globe size={14} />} label="Website" value={school?.website} />
                     <PreviewItem icon={<MapPin size={14} />} label="Address" value={school?.address} dashed />
                 </div>
             </div>
         </div>
    )
}

function PreviewItem({ icon, label, value, dashed }: any) {
    return (
        <div className="group">
             <div className="flex items-center gap-2 text-slate-400 mb-1">
                 {icon}
                 <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
             </div>
             <p className={`text-sm font-bold text-slate-700 break-words ${dashed ? 'border-b border-dashed border-slate-300 pb-1' : ''}`}>
                 {value || "----------------"}
             </p>
        </div>
    )
}

function CreateBranchForm({ school, onCancel, initialData }: any) {
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(formData);
            
            if (initialData?.branch_id) {
                await branchService.update(initialData.branch_id, data);
            } else {
                await branchService.create({ ...data, school_id: school.school_id } as any);
            }
            onCancel();
        } catch (error) {
            console.error(error);
            alert("Failed to save branch");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <CardForm 
            title={initialData ? "Edit Branch Campus" : "New Branch Campus"} 
            onCancel={onCancel} 
            onSubmit={handleSubmit}
            submitLabel={submitting ? (<Loader2 className="animate-spin" />) : (initialData ? "Update" : "Create")}
        >
             <div className="space-y-6">
                 <InputGroup label="Branch Name" name="branch_name" required placeholder="e.g. North Campus" defaultValue={initialData?.branch_name} />
                 <InputGroup label="Phone" name="phone" required placeholder="Contact Number" defaultValue={initialData?.phone} />
                 <InputGroup label="Address" name="address" required placeholder="Location Address" defaultValue={initialData?.address} />
             </div>
        </CardForm>
    )
}

// --- Generic UI Helpers ---

function CardForm({ title, children, onCancel, onSubmit, submitLabel = "Create" }: any) {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-6 sm:p-8 md:p-12 animate-in zoom-in-95 duration-300 relative">
             <button 
                onClick={onCancel}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
             >
                <X size={24} />
             </button>
             <div className="text-center mb-8">
                 <h2 className="text-2xl font-black text-slate-800">{title}</h2>
             </div>
             <form onSubmit={onSubmit}>
                 {children}
                 <div className="flex gap-4 mt-8">
                     <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-xl font-bold text-slate-400 hover:bg-slate-50">Cancel</button>
                     <button type="submit" className="flex-1 py-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200">{submitLabel}</button>
                 </div>
             </form>
        </div>
    )
}

function InputGroup({ label, name, type="text", required, defaultValue, placeholder, icon, className, onChange, ...props }: any) {
    return (
        <div className={`space-y-2 ${className}`}>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 ml-1 uppercase tracking-wide">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="relative group">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10">
                        {icon}
                    </div>
                )}
                <input 
                    name={name}
                    type={type}
                    required={required}
                    defaultValue={defaultValue}
                    placeholder={placeholder}
                    step={props.step}
                    onChange={onChange}
                    className={`w-full ${icon ? 'pl-14 pr-5' : 'px-5'} py-4 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-blue-500/20 focus:bg-white outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm`}
                />
            </div>
        </div>
    )
}
