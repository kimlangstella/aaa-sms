import { db } from "@/lib/firebase";
import { InventoryItem } from "@/lib/types";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, where, getDoc } from "firebase/firestore";

const COLLECTION_NAME = "inventory";

export const inventoryService = {
    // Get all inventory items
    getAll: async (branchIds?: string[]): Promise<InventoryItem[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME));
            if (branchIds && branchIds.length > 0) {
                q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
            }
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as InventoryItem[];

            if (branchIds && branchIds.length > 0) {
                items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                return items;
            }

            return items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } catch (error) {
            console.error("Error fetching inventory items:", error);
            return [];
        }
    },

    // Create a new inventory item
    create: async (data: Omit<InventoryItem, 'id'>): Promise<string> => {
        try {
            const dataToSave = {
                ...data,
                created_at: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
            return docRef.id;
        } catch (error) {
            console.error("Error creating inventory item:", error);
            throw error;
        }
    },

    // Update an inventory item
    update: async (id: string, data: Partial<InventoryItem>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating inventory item:", error);
            throw error;
        }
    },

    // Delete an inventory item
    delete: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting inventory item:", error);
            throw error;
        }
    },

    // Subscribe to real-time changes
    subscribe: (callback: (items: InventoryItem[]) => void, branchIds?: string[]) => {
        let q = query(collection(db, COLLECTION_NAME));
        if (branchIds && branchIds.length > 0) {
            q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
        }
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as InventoryItem[];

            if (branchIds && branchIds.length > 0) {
                items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            }

            callback(items);
        }, (error) => {
            console.error("Inventory subscription error:", error);
        });
    },

    // Decrement stock for an item or specific variant
    decrementStock: async (itemId: string, qty: number, variantId?: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, itemId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.warn(`Stock Deduction: Item ${itemId} not found.`);
                return;
            }

            const item = docSnap.data() as InventoryItem;
            const attributes = item.attributes || {};
            const updates: any = {};

            // 1. Handle Variants if applicable
            if (variantId && attributes.variants) {
                const variants = [...attributes.variants];
                const vIdx = variants.findIndex(v => v.id === variantId);
                if (vIdx !== -1) {
                    const currentStock = variants[vIdx].stock || 0;
                    const newStock = Math.max(0, currentStock - qty);
                    
                    variants[vIdx].stock = newStock;
                    
                    // Update variant status
                    if (newStock === 0) variants[vIdx].status = 'Out of Stock';
                    else if (newStock <= (variants[vIdx].lowStockLevel || 0)) variants[vIdx].status = 'Low Stock';
                    else variants[vIdx].status = 'In Stock';

                    updates["attributes.variants"] = variants;
                    console.log(`Stock Deduction: Updated variant ${variants[vIdx].name} to ${newStock}`);
                }
            }

            // 2. Update Stock Out (total outward)
            updates["attributes.stockOut"] = (attributes.stockOut || 0) + qty;

            // 3. Update totalStock if it exists
            if (typeof attributes.totalStock === 'number') {
                updates["attributes.totalStock"] = Math.max(0, attributes.totalStock - qty);
            }

            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error decrementing stock:", error);
            throw error;
        }
    }
};
