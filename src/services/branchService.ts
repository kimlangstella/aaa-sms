import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, where, documentId } from "firebase/firestore";

const COLLECTION_NAME = "branches";

export const branchService = {
    // Get all branches
    getAll: async (branchIds?: string[]): Promise<Branch[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy("branch_name"));
            if (branchIds && branchIds.length > 0) {
                // Remove orderBy to bypass the need for a composite index
                q = query(collection(db, COLLECTION_NAME), where(documentId(), "in", branchIds));
            }
            const querySnapshot = await getDocs(q);
            const branches = querySnapshot.docs.map((doc) => ({
                ...doc.data(),
                branch_id: doc.id,
            })) as Branch[];

            // Client-side sort
            if (branchIds && branchIds.length > 0) {
                branches.sort((a, b) => (a.branch_name || "").localeCompare(b.branch_name || ""));
            }
            return branches;
        } catch (error) {
            console.error("Error fetching branches:", error);
            return [];
        }
    },

    // Create a new branch
    create: async (data: Omit<Branch, "branch_id">): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
            return docRef.id;
        } catch (error) {
            console.error("Error creating branch:", error);
            throw error;
        }
    },

    // Update a branch
    update: async (branch_id: string, data: Partial<Branch>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, branch_id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating branch:", error);
            throw error;
        }
    },

    // Delete a branch
    delete: async (branch_id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, branch_id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting branch:", error);
            throw error;
        }
    },

    // Subscribe to real-time changes
    subscribe: (callback: (branches: Branch[]) => void, branchIds?: string[]) => {
        let q = query(collection(db, COLLECTION_NAME), orderBy("branch_name"));
        if (branchIds && branchIds.length > 0) {
            // Remove orderBy to bypass the need for a composite index
            q = query(collection(db, COLLECTION_NAME), where(documentId(), "in", branchIds));
        }
        return onSnapshot(q, (snapshot) => {
            const branches = snapshot.docs.map((doc) => ({
                ...doc.data(),
                branch_id: doc.id,
            })) as Branch[];

            // Client-side sort
            if (branchIds && branchIds.length > 0) {
                branches.sort((a, b) => (a.branch_name || "").localeCompare(b.branch_name || ""));
            }
            callback(branches);
        }, (error) => {
            console.error("Error subscribing to branches:", error);
        });
    }
};
