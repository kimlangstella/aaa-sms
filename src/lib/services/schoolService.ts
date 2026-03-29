
import { db, storage } from "../firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    Student,
    Class,
    Enrollment,
    Attendance,
    StudentStatus,
    AttendanceStatus,
    School
} from "../types";

// Collection References
const studentsCol = collection(db, "students");
const classesCol = collection(db, "classes");
const enrollmentsCol = collection(db, "enrollments");
const attendanceCol = collection(db, "attendance");
const schoolsCol = collection(db, "schools");

// --- School Services ---

export const getSchoolDetails = async () => {
    try {
        const snapshot = await getDocs(schoolsCol);
        if (snapshot.empty) return null;
        return { school_id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as School;
    } catch (error) {
        console.error("Error fetching school details:", error);
        throw error;
    }
};

export const subscribeToSchoolDetails = (callback: (school: School | null) => void) => {
    return onSnapshot(schoolsCol, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
        } else {
            callback({ school_id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as School);
        }
    }, (error) => {
        console.error("Error subscribing to school details:", error);
    });
};

export const updateSchoolDetails = async (id: string, data: Partial<School>) => {
    try {
        const docRef = doc(db, "schools", id);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error("Error updating school details:", error);
        throw error;
    }
};

export const createSchoolDetails = async (data: Omit<School, 'school_id'>) => {
    try {
        const docRef = await addDoc(schoolsCol, data);
        return { school_id: docRef.id, ...data };
    } catch (error) {
        console.error("Error creating school details:", error);
        throw error;
    }
};

// --- Storage Services ---
export const uploadImage = async (file: File, path: string) => {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

// --- Student Services ---

export const addStudent = async (studentData: Omit<Student, 'student_id' | 'created_at'>, actorName?: string) => {
    try {
        const now = new Date().toISOString();
        const actor = actorName || 'Admin';
        const docRef = await addDoc(studentsCol, {
            ...studentData,
            created_at: now,
            created_by: actor,
            modified_at: now,
            modified_by: actor
        });
        return { id: docRef.id, ...studentData };
    } catch (error) {
        console.error("Error adding student:", error);
        throw error;
    }
};

export const getStudents = async (branchIds?: string[]) => {
    try {
        let q = query(studentsCol, orderBy("created_at", "desc"));
        if (branchIds && branchIds.length > 0) {
            // Remove orderBy to avoid requiring a composite index in Firestore.
            // We will sort the results client-side instead.
            q = query(studentsCol, where("branch_id", "in", branchIds));
        }
        const snapshot = await getDocs(q);
        const students = snapshot.docs.map(doc => ({
            student_id: doc.id,
            ...doc.data()
        } as Student));

        // Client-side sort if we had to bypass Firestore's orderBy
        if (branchIds && branchIds.length > 0) {
            students.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }
        return students;
    } catch (error) {
        console.error("Error fetching students:", error);
        throw error;
    }
};

export const subscribeToStudents = (callback: (students: Student[]) => void, branchIds?: string[]) => {
    let q = query(studentsCol, orderBy("created_at", "desc"));
    if (branchIds && branchIds.length > 0) {
        // Remove orderBy to avoid requiring a composite index
        q = query(studentsCol, where("branch_id", "in", branchIds));
    }
    return onSnapshot(q, (snapshot) => {
        const students = snapshot.docs.map(doc => ({
            student_id: doc.id,
            ...doc.data()
        } as Student));

        // Client-side sort if we bypassed Firestore's orderBy
        if (branchIds && branchIds.length > 0) {
            students.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }
        callback(students);
    }, (error) => {
        console.error("Error subscribing to students:", error);
    });
};

export const getStudentById = async (id: string) => {
    try {
        const docRef = doc(db, "students", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { student_id: docSnap.id, ...docSnap.data() } as Student;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting student:", error);
        throw error;
    }
};

/**
 * Checks if a phone number already exists in the students collection,
 * searching across both student 'phone' and 'parent_phone' fields.
 */
export const checkPhoneDuplicate = async (phone: string) => {
    try {
        const cleanedPhone = phone.replace(/\D/g, '');
        if (!cleanedPhone) return [];

        // Check student phone
        const q1 = query(studentsCol, where("phone", "==", phone));
        const q2 = query(studentsCol, where("parent_phone", "==", phone));

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const duplicates = new Map();
        snap1.docs.forEach(doc => duplicates.set(doc.id, { id: doc.id, ...doc.data() }));
        snap2.docs.forEach(doc => duplicates.set(doc.id, { id: doc.id, ...doc.data() }));

        return Array.from(duplicates.values());
    } catch (error) {
        console.error("Error checking phone duplicate:", error);
        return [];
    }
};

// --- Enrollment Services ---

export const addEnrollment = async (data: any) => {
    try {
        // Map field names to match the Enrollment type
        const enrollmentData: any = {
            ...data,
            enrolled_at: new Date().toISOString(),
            // Ensure enrollment_status is set (default to Active)
            enrollment_status: data.enrollment_status || 'Active',
            // Map status to payment_status if needed
            payment_status: data.payment_status || data.status || 'Unpaid',
            // Map fee_type to payment_type if needed
            payment_type: data.payment_type || data.fee_type || 'Cash',
        };

        // Remove old field names if they exist
        delete enrollmentData.status;
        delete enrollmentData.fee_type;

        const docRef = await addDoc(enrollmentsCol, enrollmentData);
        return docRef.id;
    } catch (error) {
        console.error("Error adding enrollment:", error);
        throw error;
    }
};

export const updateEnrollment = async (id: string, data: Partial<Enrollment>) => {
    try {
        const docRef = doc(db, "enrollments", id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error("Error updating enrollment:", error);
        throw error;
    }
};

export const deleteEnrollment = async (id: string) => {
    try {
        const docRef = doc(db, "enrollments", id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting enrollment:", error);
        throw error;
    }
};

export const subscribeToEnrollments = (callback: (data: Enrollment[]) => void, branchIds?: string[]) => {
    // Fetch all enrollments without branch filter to avoid missing field errors
    const q = query(enrollmentsCol, orderBy("enrolled_at", "desc"));


    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            // Ensure enrolled_at exists, fallback to created_at
            if (!docData.enrolled_at && docData.created_at) {
                docData.enrolled_at = docData.created_at;
            }
            return {
                enrollment_id: doc.id,
                ...docData
            } as Enrollment;
        });

        // Sort client-side if we bypassed Firestore order
        if (branchIds && branchIds.length > 0) {
            data.sort((a: any, b: any) => new Date(b.enrolled_at || 0).getTime() - new Date(a.enrolled_at || 0).getTime());
        }
        callback(data);
    }, (error) => {
        console.error("Error subscribing to enrollments:", error);
    });
};

// Get enrollments by student ID
export const getEnrollmentsByStudent = async (studentId: string): Promise<Enrollment[]> => {
    const q = query(enrollmentsCol, where("student_id", "==", studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        enrollment_id: doc.id,
        ...doc.data()
    } as Enrollment));
};

// Deactivate or Hold all enrollments for a student
export const deactivateStudentEnrollments = async (studentId: string, status: 'Inactive' | 'Hold' = 'Inactive'): Promise<void> => {
    const enrollments = await getEnrollmentsByStudent(studentId);
    const updatePromises = enrollments.map(enrollment =>
        updateDoc(doc(db, "enrollments", enrollment.enrollment_id), {
            enrollment_status: status, // Use enrollment_status for consistency
            status: status, // Keep status as backup
            updated_at: Timestamp.now()
        })
    );
    await Promise.all(updatePromises);
};

export const updateStudent = async (id: string, data: Partial<Student>, actorName?: string) => {
    try {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, {
            ...data,
            modified_at: new Date().toISOString(),
            modified_by: actorName || 'Admin'
        });
        return true;
    } catch (error) {
        console.error("Error updating student:", error);
        throw error;
    }
};

export const deleteStudent = async (id: string) => {
    try {
        // 1. Delete all enrollments for this student
        const enrollmentsQuery = query(enrollmentsCol, where("student_id", "==", id));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        const deleteEnrollmentPromises = enrollmentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteEnrollmentPromises);

        // 2. Delete the student document
        const docRef = doc(db, "students", id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting student:", error);
        throw error;
    }
};

// --- Class Services ---

export const addClass = async (classData: Omit<Class, 'class_id'>) => {
    try {
        const docRef = await addDoc(classesCol, classData);
        return { id: docRef.id, ...classData };
    } catch (error) {
        console.error("Error adding class:", error);
        throw error;
    }
};

export const getClasses = async (branchId?: string) => {
    try {
        let q = classesCol;
        // if (branchId) q = query(classesCol, where("branch_id", "==", branchId)); // Uncomment if filtering by branch
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            class_id: doc.id,
            ...doc.data()
        } as Class));
    } catch (error) {
        console.error("Error fetching classes:", error);
        throw error;
    }
};

export const subscribeToClasses = (callback: (classes: Class[]) => void, branchIds?: string[], programId?: string) => {
    // Omitting Firebase queries for branchId/programId as some documents lack it
    let q = query(classesCol);


    return onSnapshot(q, (snapshot) => {
        let classes = snapshot.docs.map(doc => ({
            class_id: doc.id,
            ...doc.data()
        } as Class));

        // Client-side filtering
        if (branchIds && branchIds.length > 0) {
            classes = classes.filter(c => branchIds.includes(c.branchId));
        }
        if (programId) {
            classes = classes.filter(c => c.programId === programId);
        }

        callback(classes);
    }, (error) => {
        console.error("Error subscribing to classes:", error);
    });
};

export const updateClass = async (id: string, data: Partial<Class>) => {
    try {
        const docRef = doc(db, "classes", id);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error("Error updating class:", error);
        throw error;
    }
};

export const deleteClass = async (id: string) => {
    try {
        const docRef = doc(db, "classes", id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting class:", error);
        throw error;
    }
};

// --- Enrollment Services ---

export const enrollStudent = async (enrollmentData: Omit<Enrollment, 'enrollment_id' | 'enrolled_at'>) => {
    try {
        const docRef = await addDoc(enrollmentsCol, {
            ...enrollmentData,
            enrolled_at: new Date().toISOString()
        });
        return { id: docRef.id, ...enrollmentData };
    } catch (error) {
        console.error("Error enrolling student:", error);
        throw error;
    }
};

export const getEnrollmentsByClass = async (classId: string) => {
    try {
        const q = query(enrollmentsCol, where("class_id", "==", classId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            enrollment_id: doc.id,
            ...doc.data()
        } as Enrollment));
    } catch (error) {
        console.error("Error fetching enrollments:", error);
        throw error;
    }
};

export const subscribeToEnrollmentsByClass = (classId: string, callback: (enrollments: Enrollment[]) => void) => {
    const q = query(enrollmentsCol, where("class_id", "==", classId));
    return onSnapshot(q, (snapshot) => {
        const enrollments = snapshot.docs.map(doc => ({
            enrollment_id: doc.id,
            ...doc.data()
        } as Enrollment));
        callback(enrollments);
    }, (error) => {
        console.error("Error subscribing to enrollments:", error);
    });
};

// --- Attendance Services ---

export const recordAttendance = async (attendanceData: Omit<Attendance, 'attendance_id' | 'recorded_at'>) => {
    try {
        const docRef = await addDoc(attendanceCol, {
            ...attendanceData,
            recorded_at: new Date().toISOString()
        });
        return { id: docRef.id, ...attendanceData };
    } catch (error) {
        console.error("Error recording attendance:", error);
        throw error;
    }
};

export const getAttendance = async (classId: string, date: string) => {
    try {
        const q = query(attendanceCol,
            where("class_id", "==", classId),
            where("session_date", "==", date)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            attendance_id: doc.id,
            ...doc.data()
        } as Attendance));
    } catch (error) {
        console.error("Error fetching attendance:", error);
        throw error;
    }
};

export const updateAttendanceStatus = async (attendanceId: string, status: AttendanceStatus, reason?: string) => {
    try {
        const docRef = doc(attendanceCol, attendanceId);
        const updateData: any = {
            status,
            recorded_at: new Date().toISOString()
        };

        // Only include reason if it's provided
        if (reason !== undefined) {
            updateData.reason = reason;
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        console.error("Error updating attendance:", error);
        throw error;
    }
};

export const deleteAttendance = async (attendanceId: string) => {
    try {
        const docRef = doc(attendanceCol, attendanceId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting attendance:", error);
        throw error;
    }
};

export const subscribeToAttendance = (classId: string, callback: (attendance: Attendance[]) => void) => {
    const q = query(attendanceCol, where("class_id", "==", classId));
    return onSnapshot(q, (snapshot) => {
        const attendance = snapshot.docs.map(doc => ({
            attendance_id: doc.id,
            ...doc.data()
        } as Attendance));
        callback(attendance);
    }, (error) => {
        console.error("Error subscribing to attendance:", error);
    });
};

export const subscribeToDailyAttendance = (date: string, callback: (attendance: Attendance[]) => void, branchIds?: string[]) => {
    let q = query(attendanceCol, where("session_date", "==", date));
    // Since attendance might not have branch_id directly (it has class_id), 
    // we might need to filter classes first or ensure attendance has branch_id.
    // Looking at DATABASE_SCHEMA.md, attendance does NOT have branch_id.
    // However, for "Daily Attendance", we usually want to see everything for a branch.
    // If we want to filter attendance by branch, we ideally should have branch_id in the attendance doc.
    // For now, if branchIds are provided, this subscription might be tricky without a join or schema update.
    // Assuming for now we might add branch_id to attendance or just filter client side if the list is small.
    // But let's check if the user wants to add branch_id to attendance.

    return onSnapshot(q, (snapshot) => {
        let attendance = snapshot.docs.map(doc => ({
            attendance_id: doc.id,
            ...doc.data()
        } as Attendance));

        // Final fallback: client side filter if we don't have indexes yet
        // callback(attendance);
        callback(attendance);
    }, (error) => {
        console.error("Error subscribing to daily attendance:", error);
    });
};
// Get the last recorded session number for a class (to auto-fill enrollment start)
// Get the last recorded session number for a class (to auto-fill enrollment start)
export const getLastSessionForClass = async (classId: string, termId?: string) => {
    try {
        let termRange: { start: string, end: string } | null = null;
        if (termId) {
            const termDoc = await getDoc(doc(db, "terms", termId));
            if (termDoc.exists()) {
                const data = termDoc.data();
                termRange = {
                    start: data.start_date,
                    end: data.end_date
                };
            }
        }

        // Query ALL attendance records for this class (Client-side filtering to avoid index)
        const q = query(
            attendanceCol,
            where("class_id", "==", classId)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) return 0;

        // Map to session numbers
        const sessions = snapshot.docs.map(doc => {
            const data = doc.data();
            const sessionDate = data.session_date;

            // Filter by date range if available
            if (termRange && sessionDate) {
                if (sessionDate < termRange.start || sessionDate > termRange.end) {
                    return 0;
                }
            }

            // Handle possible string/number types
            return Number(data.session_number || 0);
        });

        // Filter valid sessions (greater than 0)
        const validSessions = sessions.filter(s => s > 0 && !isNaN(s));

        if (validSessions.length === 0) return 0;

        // Find max (Last Session)
        return Math.max(...validSessions);

    } catch (error) {
        // Fallback if index missing or error
        console.error("Error fetching last session:", error);
        return 0;
    }
};
