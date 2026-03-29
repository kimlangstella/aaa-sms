export type UserRole = 'admin' | 'superAdmin';

export interface AppUser {
    uid: string;
    email: string | null;
    role: UserRole;
    name?: string;
    branchIds: string[]; // admin: ["branch_1"] or multiple; superAdmin: []
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
    signature_url?: string;
}

export type Role = 'Admin' | 'Teacher' | 'Student' | 'Parent';

export type Gender = 'Male' | 'Female';
export type StudentStatus = 'Active' | 'Hold' | 'Inactive';
export type PaymentStatus = 'Paid' | 'Unpaid';
export type PaymentType = 'Cash' | 'ABA';
export type EnrollmentStatus = 'Active' | 'Hold' | 'Completed' | 'Dropped';
export type AttendanceStatus = 'Present' | 'Absent' | 'Permission';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface School {
    school_id: string;
    school_name: string;
    address: string;
    contact_info: string;
    email: string;
    website?: string;
    logo_url?: string;
}

export interface Branch {
    branch_id: string;
    school_id: string; // Reference to school
    branch_name: string;
    address: string;
    phone: string;
    email?: string;
    location?: string; // GPS or general area
}

export interface Program {
    id: string; // Document ID from Firestore
    name: string;
    description?: string;
    total_sessions?: number;
    price: number;
    pricePerSession?: number;
    branchId?: string;
    needs_inventory?: boolean;
    inventoryItemIds?: string[];
    variants?: ProgramVariant[];
}

export interface ProgramVariant {
    id: string;
    label: string; // e.g. "Guitar", "Violin"
    price: number;
    time?: string; // e.g. "30mn", "1h"
}

export interface Class {
    class_id: string; // Document ID (mapped from Firestore doc.id)
    branchId: string;
    programId: string;
    className: string;
    days: string[]; // Array of day strings
    startTime: string; // "08:00"
    endTime: string; // "10:00"
    maxStudents: number;
    totalSessions: number;
    createdAt?: any;
    // Computed/Joined fields for display
    program_name?: string;
}

export interface Student {
    student_id: string; // Document ID
    student_code: string; // "Student ID"
    student_name: string; // Derived or full name
    first_name: string;
    last_name: string;
    email?: string;
    age: number;
    gender: Gender;
    dob: string;
    pob: string; // Place of Birth
    nationality: string;
    branch_id: string;
    address: string;
    phone: string;
    status: StudentStatus;
    admission_date: string;

    // Parent Info
    father_name?: string;
    father_occupation?: string;
    mother_name?: string;
    mother_occupation?: string;
    parent_phone: string;

    // Metadata
    created_at: string;
    created_by?: string;
    modified_by?: string;
    modified_at?: string;
    image_url?: string;

    // Insurance
    insurance_info?: {
        provider: string;
        policy_number: string;
        type: string;
        coverage_amount: number;
        claimed_amount?: number;
        start_date: string;
        end_date: string;
        claims?: InsuranceClaim[];
    };
}

export interface InsuranceClaim {
    amount: number;
    date: string;
    term_id: string;
    image_url?: string;
    note?: string;
}

export interface Enrollment {
    enrollment_id: string; // Document ID
    student_id: string;
    class_id: string;
    term: string; // e.g. 2026_T1 (legacy)
    term_id?: string; // Document ID of the term

    total_amount: number;
    discount: number;
    paid_amount: number;
    payment_status: PaymentStatus; // "Paid" or "Unpaid"
    payment_type: PaymentType; // "Cash" or "ABA"
    payment_due_date?: string; // Date string
    payment_expired?: string; // Date string
    branchId?: string;
    programId?: string;

    enrollment_status: EnrollmentStatus; // Active, Hold, Completed, Dropped
    selectedVariantId?: string;

    // Enrollment details
    start_session: number; // Session number (1-12)
    enrolled_at: string;
    student?: Student; // Optional joined student
    selectedAddons?: EnrollmentAddon[]; // Snapshot of selected add-ons
}

export interface Attendance {
    attendance_id: string;
    enrollment_id: string;
    class_id: string;
    student_id: string;

    session_date: string; // Date
    session_number: number;
    term?: string; // Optional if needed

    status: AttendanceStatus;
    reason?: string;

    recorded_at: string;
}

export interface TimeTableEntry {
    class_id: string;
    class_name: string;
    program_name: string;
    start_time: string;
    end_time: string;
    day: string;
}

export interface Term {
    term_id: string;
    term_name: string; // e.g., "2026 Term 1", "Spring 2026"
    start_date: string;
    end_date: string;
    branch_id: string;
    program_ids: string[]; // Changed to array for multiple programs
    status: 'Active' | 'Upcoming' | 'Completed' | 'Inactive';
    created_at: string;
}

export interface InventoryVariant {
    id: string;
    name: string; // e.g. "Toddler - S"
    sku?: string;
    costPrice?: number;
    retailPrice?: number;
    stock: number;
    lowStockLevel?: number; // Reorder point
    status: 'In Stock' | 'Out of Stock' | 'Low Stock';
}

export interface ProductGroup {
    id: string;
    branchId: string;
    name: string;
    description?: string;
    created_at: string;
}

export interface InventoryItem {
    id: string;
    branchId: string;
    programId?: string; // Linked program
    name: string;
    groupId?: string; // Links to ProductGroup. id
    category: 'Uniform' | 'Book' | 'Accessory' | 'Equipment' | 'Other';
    sku?: string; // For single items
    costPrice?: number; // For single items
    price: number; // Retail price (legacy name kept for compatibility)
    image_url?: string;
    attributes?: {
        hasVariants?: boolean;
        variants?: InventoryVariant[];
        sizes?: string[]; // e.g. ["S", "M", "L"] (legacy/reference)
        sizeStock?: { [size: string]: number }; // e.g. { "S": 10, "M": 5 }
        totalStock?: number; // Current Balance
        stockIn?: number; // Total Inward
        stockOut?: number; // Total Outward
        lowStockLevel?: number; // Reorder Point
    };
    created_at: string;
}

export interface ProgramAddon {
    id: string; // Document ID
    programId: string;
    itemId: string; // Refers to InventoryItem ID
    type: 'inventory' | 'service';
    label?: string; // e.g. "Taekwondo Uniform"
    defaultQty: number;
    isOptional: boolean;
    isRecommended?: boolean;
    limitPerStudent?: number;
    sortOrder?: number;
    // Computed/Joined fields (not stored in db)
    item_name?: string;
    item_price?: number;
}

export interface EnrollmentAddon {
    addonId: string; // Refers to ProgramAddon ID
    itemId: string;   // Refers to InventoryItem ID, helps for inventory tracking
    nameSnapshot: string;
    priceSnapshot: number;
    qty: number;
    variantId?: string;
    variantName?: string;
}
