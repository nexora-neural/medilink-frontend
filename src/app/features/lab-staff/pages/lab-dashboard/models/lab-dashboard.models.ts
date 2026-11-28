export type LabDashboardState = 'ready' | 'loading' | 'empty' | 'error' | 'denied' | 'expired';

export interface LabDashboardReport {
  id: string;
  type: string;
  date: string;
  reference: string;
  status: 'Published' | 'Superseded' | 'Withdrawn';
}

export interface LabDashboardSummary {
  totalReports: number;
  laboratory: string;
  verification: string;
}
