import { db } from "@/lib/firebase";
import { Program } from "@/lib/types";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, where } from "firebase/firestore";

const COLLECTION_NAME = "programs";

export const programService = {
    // Get all programs
    getAll: async (branchIds?: string[]): Promise<any[]> => {
        try {
            let q = query(collection(db, COLLECTION_NAME));
            if (branchIds && branchIds.length > 0) {
                // Remove orderBy to avoid composite index error
                q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
            }
            const querySnapshot = await getDocs(q);
            const programs = querySnapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            }));

            // Client-side sort
            if (branchIds && branchIds.length > 0) {
                programs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
                return programs;
            }

            return programs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        } catch (error) {
            console.error("Error fetching programs:", error);
            return [];
        }
    },

    // Create a new program
    create: async (data: any): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
            return docRef.id;
        } catch (error) {
            console.error("Error creating program:", error);
            throw error;
        }
    },

    // Update a program
    update: async (id: string, data: any): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating program:", error);
            throw error;
        }
    },

    // Delete a program
    delete: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting program:", error);
            throw error;
        }
    },

    // Subscribe to real-time changes
    subscribe: (callback: (programs: any[]) => void, branchIds?: string[]) => {
        let q = query(collection(db, COLLECTION_NAME), orderBy("name"));
        if (branchIds && branchIds.length > 0) {
            // Remove orderBy to avoid composite index error
            q = query(collection(db, COLLECTION_NAME), where("branchId", "in", branchIds));
        }
        return onSnapshot(q, (snapshot) => {
            const programs = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            }));

            // Client-side sort
            if (branchIds && branchIds.length > 0) {
                programs.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            }

            callback(programs);
        }, (error) => {
            console.error("Error subscribing to programs:", error);
        });
    }
};
