export type LabDashboardState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export interface LabDashboardReport {
  id: string;
  type: string;
  date: string;
  reference: string;
  status: 'Published' | 'Superseded' | 'Withdrawn';
}

export interface LabDashboardSummary {
  openRequests: number;
  publishedReports: number;
  laboratory: string;
  verification: string;
}
