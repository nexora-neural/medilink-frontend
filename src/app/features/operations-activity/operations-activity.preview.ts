import {
  AuditEvent,
  BackupEvidence,
  OperationJob,
  PatientActivity,
} from './operations-activity.models';
export const AUDIT_PREVIEW: readonly AuditEvent[] = [
  {
    id: 'audit-1',
    event: 'Professional application opened',
    actor: 'Nimali Perera',
    date: '2026-10-31',
    reason: 'Routine review',
    privileged: false,
  },
  {
    id: 'audit-2',
    event: 'Integration client registered',
    actor: 'Ravi Fernando',
    date: '2026-10-31',
    reason: 'Organization request',
    privileged: true,
  },
];
export const JOB_PREVIEW: readonly OperationJob[] = [
  {
    id: 'JOB-DEMO-104',
    name: 'Notification delivery',
    status: 'Failed',
    attempts: 1,
    maxAttempts: 3,
  },
];
export const BACKUP_PREVIEW: readonly BackupEvidence[] = [
  {
    id: 'BKP-DEMO-031',
    completedAt: '2026-10-31 02:00 UTC',
    status: 'Completed',
    verification: 'Verification passed',
  },
];
export const PATIENT_ACTIVITY_PREVIEW: readonly PatientActivity[] = [
  {
    id: 'activity-1',
    actor: 'Dr. Maya Perera',
    action: 'Expired',
    scope: 'Prescriptions, reports',
    occurredAt: 'Nov 15, 2026, 12:00:00 PM',
  },
];
