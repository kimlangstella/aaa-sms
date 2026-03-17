import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, UserRole } from "@/lib/types";

const COLLECTION_NAME = "users";

export const userService = {
    async createProfile(uid: string, email: string, name?: string) {
        const userRef = doc(db, COLLECTION_NAME, uid);
        const profile: AppUser = {
            uid,
            email,
            role: 'admin',
            name: name || '',
            branchIds: [],
            active: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await setDoc(userRef, profile);
        return profile;
    },

    async getUserById(uid: string): Promise<AppUser | null> {
        const userRef = doc(db, COLLECTION_NAME, uid);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
            return { ...snapshot.data() } as AppUser;
        }
        return null;
    },

    async updateProfile(uid: string, data: Partial<AppUser>) {
        const userRef = doc(db, COLLECTION_NAME, uid);
        await updateDoc(userRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    },

    async deleteProfile(uid: string) {
        const userRef = doc(db, COLLECTION_NAME, uid);
        await deleteDoc(userRef);
    },

    subscribeToUsers(callback: (users: AppUser[]) => void) {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ ...doc.data() } as AppUser));
            callback(users);
        });
    },

    async getAllUsers(): Promise<AppUser[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() } as AppUser));
    }
};
