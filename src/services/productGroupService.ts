import { db } from "@/lib/firebase";
import { ProductGroup } from "@/lib/types";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, where } from "firebase/firestore";

const COLLECTION_NAME = "product_groups";

export const productGroupService = {
    // Get all product groups
    getAll: async (branchIds?: string[]): Promise<ProductGroup[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME));
            if (branchIds && branchIds.length > 0) {
                q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
            }
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as ProductGroup[];

            if (branchIds && branchIds.length > 0) {
                items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                return items;
            }

            return items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } catch (error) {
            console.error("Error fetching product groups:", error);
            return [];
        }
    },

    // Create a new product group
    create: async (data: Omit<ProductGroup, 'id' | 'created_at'>): Promise<string> => {
        try {
            const dataToSave = {
                ...data,
                created_at: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave);
            return docRef.id;
        } catch (error) {
            console.error("Error creating product group:", error);
            throw error;
        }
    },

    // Update a product group
    update: async (id: string, data: Partial<ProductGroup>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating product group:", error);
            throw error;
        }
    },

    // Delete a product group
    delete: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting product group:", error);
            throw error;
        }
    },

    // Subscribe to real-time changes
    subscribe: (callback: (items: ProductGroup[]) => void, branchIds?: string[]) => {
        let q = query(collection(db, COLLECTION_NAME));
        if (branchIds && branchIds.length > 0) {
            q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
        }
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as ProductGroup[];

            if (branchIds && branchIds.length > 0) {
                items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            }

            callback(items);
        }, (error) => {
            console.error(error);
        });
    }
};
