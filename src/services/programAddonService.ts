import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    onSnapshot
} from "firebase/firestore";
import { ProgramAddon } from "@/lib/types";

// Collection Reference
const addonsCol = collection(db, "program_addons");

export const addProgramAddon = async (data: Omit<ProgramAddon, 'id'>) => {
    try {
        const docRef = await addDoc(addonsCol, {
            ...data,
            created_at: new Date().toISOString()
        });
        return { id: docRef.id, ...data };
    } catch (error) {
        console.error("Error adding program addon:", error);
        throw error;
    }
};

export const updateProgramAddon = async (id: string, data: Partial<ProgramAddon>) => {
    try {
        const docRef = doc(db, "program_addons", id);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error("Error updating program addon:", error);
        throw error;
    }
};

export const deleteProgramAddon = async (id: string) => {
    try {
        const docRef = doc(db, "program_addons", id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting program addon:", error);
        throw error;
    }
};

export const getProgramAddons = async (programId: string): Promise<ProgramAddon[]> => {
    try {
        const q = query(addonsCol, where("programId", "==", programId));
        const snapshot = await getDocs(q);
        const addons = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as ProgramAddon));

        // Sort client side to avoid composite index requirement for now
        return addons.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    } catch (error) {
        console.error("Error fetching program addons:", error);
        throw error;
    }
};

export const subscribeToProgramAddons = (programId: string, callback: (addons: ProgramAddon[]) => void) => {
    const q = query(addonsCol, where("programId", "==", programId));

    return onSnapshot(q, (snapshot) => {
        const addons = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as ProgramAddon));

        callback(addons.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }, (error) => {
        console.error("Error subscribing to program addons:", error);
    });
};

export const subscribeToAllProgramAddons = (callback: (addons: ProgramAddon[]) => void) => {
    return onSnapshot(addonsCol, (snapshot) => {
        const addons = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as ProgramAddon));

        callback(addons);
    }, (error) => {
        console.error("Error subscribing to all program addons:", error);
    });
};
