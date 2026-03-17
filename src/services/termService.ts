import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Term } from '@/lib/types';

const COLLECTION = 'terms';

export const termService = {
    subscribe: (callback: (terms: Term[]) => void, branchIds?: string[]) => {
        let q = query(collection(db, COLLECTION), orderBy('created_at', 'desc'));
        if (branchIds && branchIds.length > 0) {
            // Remove orderBy to bypass the need for a composite index
            q = query(collection(db, COLLECTION), where('branch_id', 'in', branchIds));
        }
        return onSnapshot(q, (snapshot) => {
            const terms = snapshot.docs.map(doc => ({
                ...doc.data(),
                term_id: doc.id
            } as Term));

            // Client-side sort
            if (branchIds && branchIds.length > 0) {
                terms.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            }
            callback(terms);
        });
    },

    // Subscribe to terms filtered by branch
    subscribeByBranch: (branchId: string, callback: (terms: Term[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('branch_id', '==', branchId),
            orderBy('created_at', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const terms = snapshot.docs.map(doc => ({
                ...doc.data(),
                term_id: doc.id
            } as Term));
            callback(terms);
        });
    },

    // Subscribe to terms filtered by program
    subscribeByProgram: (programId: string, callback: (terms: Term[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('program_ids', 'array-contains', programId),
            orderBy('created_at', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const terms = snapshot.docs.map(doc => ({
                ...doc.data(),
                term_id: doc.id
            } as Term));
            callback(terms);
        });
    },

    // Add new term
    add: async (termData: Omit<Term, 'term_id'>) => {
        return await addDoc(collection(db, COLLECTION), {
            ...termData,
            created_at: new Date().toISOString()
        });
    },

    // Update term
    update: async (termId: string, termData: Partial<Term>) => {
        const termRef = doc(db, COLLECTION, termId);
        return await updateDoc(termRef, termData);
    },

    // Get term by ID
    getById: async (termId: string): Promise<Term | null> => {
        const termRef = doc(db, COLLECTION, termId);
        const termSnap = await getDoc(termRef);
        if (termSnap.exists()) {
            return {
                ...termSnap.data(),
                term_id: termSnap.id
            } as Term;
        }
        return null;
    },

    // Delete term
    delete: async (termId: string) => {
        const termRef = doc(db, COLLECTION, termId);
        return await deleteDoc(termRef);
    },

    // Rollover Enrollments
    rolloverEnrollments: async (
        oldTermId: string,
        newTermId: string,
        options: { includeActive: boolean, includeHold: boolean } = { includeActive: true, includeHold: false }
    ) => {
        try {
            // Fetch both terms to get names and verify existence
            const oldTermDoc = await getDoc(doc(db, "terms", oldTermId));
            const newTermDoc = await getDoc(doc(db, "terms", newTermId));

            if (!oldTermDoc.exists() || !newTermDoc.exists()) {
                console.error("Old or New Term not found during rollover");
                return;
            }

            const oldTermData = oldTermDoc.data() as Term;
            const newTermData = newTermDoc.data() as Term;

            // 1. Determine statuses to copy
            const statusesToCopy = [];
            if (options.includeActive) statusesToCopy.push('Active');
            if (options.includeHold) statusesToCopy.push('Review', 'Hold');

            if (statusesToCopy.length === 0) {
                console.warn("No statuses selected for rollover.");
                return;
            }

            // 2. Query source enrollments
            let enrQuery = query(
                collection(db, 'enrollments'),
                where('term_id', '==', oldTermId),
                where('enrollment_status', 'in', statusesToCopy)
            );

            let snapshot = await getDocs(enrQuery);

            // Fallback for legacy data (term string match)
            if (snapshot.empty && oldTermData.term_name) {
                console.log("No enrollments found by ID, trying generic term name match...");
                enrQuery = query(
                    collection(db, 'enrollments'),
                    where('term', '==', oldTermData.term_name),
                    where('enrollment_status', 'in', statusesToCopy)
                );
                snapshot = await getDocs(enrQuery);
            }

            if (snapshot.empty) return;

            // 3. Pre-fetch existing enrollments in Target Term to prevent duplicates
            const existingQuery = query(
                collection(db, 'enrollments'),
                where('term_id', '==', newTermId)
            );
            const existingSnapshot = await getDocs(existingQuery);
            const existingStudentIds = new Set(existingSnapshot.docs.map(d => d.data().student_id));

            const batch = writeBatch(db);
            const enrollmentsRef = collection(db, 'enrollments');
            let operationCount = 0;
            let skippedCount = 0;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();

                // DUPLICATE CHECK
                if (existingStudentIds.has(data.student_id)) {
                    skippedCount++;
                    return; // Skip this student
                }

                const newEnrRef = doc(enrollmentsRef);
                batch.set(newEnrRef, {
                    student_id: data.student_id,
                    class_id: data.class_id,
                    term_id: newTermId,
                    term: newTermData.term_name,

                    total_amount: data.total_amount || 0,
                    discount: data.discount || 0,
                    paid_amount: 0, // Rule: Reset to 0
                    payment_status: 'Unpaid', // Rule: Always Unpaid
                    payment_type: 'Cash',

                    enrollment_status: 'Active',
                    enrolled_at: new Date().toISOString(),
                    start_session: 1
                });
                operationCount++;
            });

            if (operationCount > 0) {
                await batch.commit();
            }
            console.log(`Rolled over ${operationCount} enrollments. Skipped ${skippedCount} duplicates.`);

        } catch (error) {
            console.error("Rollover failed:", error);
            throw error;
        }
    },

    // Bulk fix for Term Data (if needed)
    resetTermBalances: async (termId: string) => {
        try {
            const q = query(collection(db, 'enrollments'), where('term_id', '==', termId));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.paid_amount > 0) {
                    batch.update(doc.ref, {
                        paid_amount: 0,
                        payment_status: 'Unpaid'
                    });
                    count++;
                }
            });

            if (count > 0) await batch.commit();
            console.log(`Reset balances for ${count} enrollments in term ${termId}`);
        } catch (error) {
            console.error("Reset failed", error);
        }
    }
};
