export type InsuranceStatus = 'Active' | 'Expired' | 'Pending' | 'Cancelled';
export type InsuranceType = 'Health' | 'Accident' | 'Life' | 'Comprehensive';

export interface InsurancePolicy {
    id: string;
    studentId: string;
    studentName: string;
    policyNumber: string;
    provider: string;
    type: InsuranceType;
    startDate: string; // ISO Date string
    endDate: string;   // ISO Date string
    status: InsuranceStatus;
    coverageAmount: number;
    claimedAmount: number;
    premiumAmount: number;
    qrCodeUrl?: string; // For digital card verification
}

export interface InsuranceStats {
    totalPolicies: number;
    activePolicies: number;
    expiringSoon: number; // Within 30 days
    totalCoverageValue: number;
}
