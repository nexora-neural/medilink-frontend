export type DashboardStatus = 'loading' | 'ready' | 'empty' | 'error';

// Synthetic frontend-preview types only. API contracts belong to ML-241.
export interface DoctorDashboardSummary {
  patientsWithAccess: number;
  patientRecords: number;
  reviewNeeded: number;
  verification: 'Verified' | 'Pending' | 'Not verified';
}

export interface DoctorPatient {
  id: string;
  name: string;
  initials: string;
  detail: string;
  accessLabel: string;
}

export interface DoctorActivity {
  id: string;
  icon: string;
  title: string;
  detail: string;
  route: string;
}
