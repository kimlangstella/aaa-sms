"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    ShoppingBag, Loader2, Search, AlertTriangle, Pencil, Trash2
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { branchService } from "@/services/branchService";
import { inventoryService } from "@/services/inventoryService";
import { programService } from "@/services/programService";
import { productGroupService } from "@/services/productGroupService";
import { Branch, InventoryItem, Program, ProductGroup } from "@/lib/types";

interface InventoryRow {
    id: string;
    itemId: string;
    variantId?: string;
    sku: string;
    productName: string;
    groupId?: string;
    groupName: string;
    branchName: string;
    programName: string;
    sizeAttribute: string;
    costPrice: number;
    retailPrice: number;
    currentStock: number;
    reorderPoint: number;
    stockOut: number;
    imageUrl?: string;
}

export default function InventoryDashboard() {
    const { profile } = useAuth();
    const router = useRouter();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [groups, setGroups] = useState<ProductGroup[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");

    // Edit modal state
    const [editTarget, setEditTarget] = useState<InventoryRow | null>(null);
    const [editRetailPrice, setEditRetailPrice] = useState("");
    const [editSafetyNet, setEditSafetyNet] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Auth check
    useEffect(() => {
        if (!profile) return;
        if (profile.role !== 'admin' && profile.role !== 'superAdmin') {
            router.push('/dashboard');
        }
    }, [profile, router]);

    // Data Fetching
    useEffect(() => {
        if (!profile) return;
        const branchIds = []; // Fetch all data regardless of role (admin/superAdmin)
        const unsubBranches = branchService.subscribe(setBranches, branchIds);
        const unsubInventory = inventoryService.subscribe((data) => {
            setItems(data);
            setLoading(false);
        }, branchIds);
        const unsubGroups = productGroupService.subscribe(setGroups, branchIds);
        const unsubPrograms = programService.subscribe(setPrograms, branchIds);

        return () => {
            unsubBranches();
            unsubInventory();
            unsubGroups();
            unsubPrograms();
        };
    }, [profile]);

    // Open edit modal
    const openEdit = (row: InventoryRow) => {
        setEditTarget(row);
        setEditRetailPrice(String(row.retailPrice));
        setEditSafetyNet(String(row.reorderPoint));
    };

    // Save edits
    const handleSaveEdit = async () => {
        if (!editTarget) return;
        const retail = parseFloat(editRetailPrice);
        const safety = parseFloat(editSafetyNet);
        if (isNaN(retail) || retail < 0 || isNaN(safety) || safety < 0) return;

        const item = items.find(i => i.id === editTarget.itemId);
        if (!item) return;

        setSaving(true);
        try {
            if (editTarget.variantId) {
                const attributes = { ...item.attributes };
                attributes.variants = attributes.variants?.map(v =>
                    v.id === editTarget.variantId
                        ? { ...v, retailPrice: retail, lowStockLevel: safety }
                        : v
                ) || [];
                await inventoryService.update(item.id, { attributes });
            } else {
                const attributes = { ...item.attributes, lowStockLevel: safety };
                await inventoryService.update(item.id, { price: retail, attributes });
            }
            setEditTarget(null);
        } catch (e) {
            console.error(e);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    // Confirm delete
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await inventoryService.delete(deleteTarget.itemId);
            setDeleteTarget(null);
        } catch (e) {
            console.error(e);
            alert("Failed to delete item.");
        } finally {
            setDeleting(false);
        }
    };

    if (!profile) return null;
    if (loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    const flattenedItems: InventoryRow[] = items.flatMap(item => {
        const branchName = branches.find(b => b.branch_id === item.branchId)?.branch_name || '';
        const programName = programs.find(p => p.id === (item as any).programId)?.name || '';
        if (item.attributes?.hasVariants && item.attributes.variants && item.attributes.variants.length > 0) {
            return item.attributes.variants.map(v => ({
                id: `${item.id}_${v.id}`,
                itemId: item.id,
                variantId: v.id,
                sku: v.sku || 'N/A',
                productName: item.name,
                groupId: item.groupId,
                groupName: groups.find(g => g.id === item.groupId)?.name || 'Unassigned',
                branchName,
                programName,
                sizeAttribute: v.name,
                costPrice: v.costPrice !== undefined ? v.costPrice : (item.costPrice || 0),
                retailPrice: v.retailPrice !== undefined ? v.retailPrice : item.price,
                currentStock: v.stock || 0,
                reorderPoint: v.lowStockLevel !== undefined ? v.lowStockLevel : 5,
                stockOut: item.attributes?.stockOut || 0, // Note: stockOut is usually total for the item
                imageUrl: item.image_url
            }));
        } else {
            return [{
                id: item.id,
                itemId: item.id,
                sku: item.sku || 'N/A',
                productName: item.name,
                groupId: item.groupId,
                groupName: groups.find(g => g.id === item.groupId)?.name || 'Unassigned',
                branchName,
                programName,
                sizeAttribute: '-',
                costPrice: item.costPrice || 0,
                retailPrice: item.price,
                currentStock: item.attributes?.totalStock || 0,
                reorderPoint: item.attributes?.lowStockLevel !== undefined ? item.attributes.lowStockLevel : 5,
                stockOut: item.attributes?.stockOut || 0,
                imageUrl: item.image_url
            }];
        }
    });

    const filteredRows = flattenedItems.filter(row => {
        const matchesSearch = row.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              row.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGroup = selectedGroupId ? row.groupId === selectedGroupId : true;
        const originalItem = items.find(i => i.id === row.itemId);
        const matchesBranch = selectedBranch && originalItem ? originalItem.branchId === selectedBranch : true;
        return matchesSearch && matchesGroup && matchesBranch;
    });

    return (
        <div className="w-full max-w-[1800px] mx-auto space-y-8 pb-20 px-4 sm:px-0 lg:px-0">
            {/* Header with Stats */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-5 relative z-10">
                        <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                            <ShoppingBag size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                Inventory Dashboard
                            </h1>
                            <p className="text-slate-500 font-medium text-sm mt-1">
                                Physical stock count and adjustments.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                        {/* Stat Card: Total Balance */}
                        <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100/50 shrink-0">
                                <ShoppingBag size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Total Balance</p>
                                <p className="text-xl font-black text-slate-900 leading-none mt-1">
                                    {items.reduce((acc, item) => acc + (item.attributes?.totalStock || 0), 0)}
                                </p>
                            </div>
                        </div>

                        {/* Stat Card: Stock Out */}
                        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100/50 shrink-0">
                                <AlertTriangle size={20} className="rotate-180" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Stock Out</p>
                                <p className="text-xl font-black text-slate-900 leading-none mt-1">
                                    {items.reduce((acc, item) => acc + (item.attributes?.stockOut || 0), 0)}
                                </p>
                            </div>
                        </div>

                        {/* Stat Card: Low Stock */}
                        <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-100/50 shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Low Stock</p>
                                <p className="text-xl font-black text-slate-900 leading-none mt-1">
                                    {flattenedItems.filter(row => row.currentStock <= row.reorderPoint).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white/60 backdrop-blur-md p-4 sm:p-6 rounded-[2rem] border border-white/50 shadow-sm">
                <div className="relative flex-1 group">
                    <input
                        type="text"
                        placeholder="Search by Product Name or SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all shadow-sm"
                    />
                    <Search size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
                </div>
                <div className="w-full sm:w-48">
                    <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="">All Branches</option>
                        {branches.map((b: any) => (
                            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full sm:w-48">
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="">All Groups</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-slate-50/80 backdrop-blur-md">
                            <tr className="border-b border-slate-100">
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 text-center">Action</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Product Name</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Group</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Branch</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Program</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Size</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 text-right">Price</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 text-center">In Stock</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 text-center text-emerald-600">Stock Out</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-4">
                                            <ShoppingBag size={32} />
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No items match your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => {
                                    const isLowStock = row.currentStock <= row.reorderPoint;
                                    return (
                                        <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isLowStock ? 'bg-rose-50/30' : ''}`}>
                                            {/* Action: Edit + Delete only */}
                                            <td className="py-3 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => openEdit(row)}
                                                        className="p-1.5 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                                                        title="Edit product"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    {profile.role === 'superAdmin' && (
                                                        <button
                                                            onClick={() => setDeleteTarget(row)}
                                                            className="p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                                                            title="Delete product"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Product Name */}
                                            <td className="py-3 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
                                                        {row.imageUrl ? (
                                                            <img src={row.imageUrl} alt={row.productName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ShoppingBag size={14} className="text-slate-200" />
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-800">{row.productName}</p>
                                                </div>
                                            </td>
                                            {/* Group */}
                                            <td className="py-3 px-6">
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{row.groupName}</span>
                                            </td>
                                            {/* Branch */}
                                            <td className="py-3 px-6">
                                                {row.branchName ? (
                                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{row.branchName}</span>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            {/* Program */}
                                            <td className="py-3 px-6">
                                                {row.programName ? (
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">{row.programName}</span>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            {/* Size */}
                                            <td className="py-3 px-6">
                                                {row.sizeAttribute !== '-' ? (
                                                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
                                                        {row.sizeAttribute}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs font-bold">-</span>
                                                )}
                                            </td>
                                            {/* Price */}
                                            <td className="py-3 px-6 text-right">
                                                <span className="text-xs font-bold text-slate-700">${row.retailPrice.toFixed(2)}</span>
                                            </td>
                                            {/* Current Stock */}
                                            <td className="py-3 px-6 text-center border-r border-slate-50">
                                                <span className={`text-sm font-black flex justify-center items-center gap-2 ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                                                    {isLowStock && <AlertTriangle size={14} className="text-rose-500" />}
                                                    {row.currentStock}
                                                </span>
                                            </td>
                                            {/* Stock Out */}
                                            <td className="py-3 px-6 text-center">
                                                <span className="text-sm font-black text-emerald-600">
                                                    {row.stockOut}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Edit Modal ── */}
            {editTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditTarget(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 z-10">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                                <Pencil size={18} className="text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Edit Product</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editTarget.productName}
                                    {editTarget.sizeAttribute !== '-' && <span className="ml-1 text-indigo-500">· {editTarget.sizeAttribute}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Retail Price ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editRetailPrice}
                                    onChange={e => setEditRetailPrice(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Safety Net (low stock threshold)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editSafetyNet}
                                    onChange={e => setEditSafetyNet(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-amber-700 focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-300 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditTarget(null)}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Delete Product?</h3>
                                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-6 bg-slate-50 rounded-xl px-4 py-3 font-semibold">
                            <span className="text-slate-400 font-normal">Deleting: </span>
                            {deleteTarget.productName}
                            {deleteTarget.sizeAttribute !== '-' && <span className="ml-1 text-indigo-600">({deleteTarget.sizeAttribute})</span>}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 size={15} className="animate-spin" /> : null}
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
