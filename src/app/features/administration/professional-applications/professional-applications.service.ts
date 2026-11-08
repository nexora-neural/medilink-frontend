import { Injectable } from '@angular/core';
import { map, timer } from 'rxjs';

export const applicationDecisions = ['Approved', 'Rejected', 'Information requested'] as const;
export type ApplicationDecision = (typeof applicationDecisions)[number];
export type ApplicationStatus = 'Pending' | 'Under review' | ApplicationDecision;

interface Evidence {
  name: string;
  fileName: string;
  uploadedAt: string;
}

interface DecisionRecord {
  decision: ApplicationDecision;
  reviewer: string;
  decidedAt: string;
  reason: string;
}

export interface ProfessionalApplication {
  id: string;
  name: string;
  role: 'Doctor' | 'Pharmacist' | 'Lab Staff';
  organization: string;
  registration: string;
  status: ApplicationStatus;
  evidence: readonly Evidence[];
  history: readonly DecisionRecord[];
}

const sampleApplications: readonly ProfessionalApplication[] = [
  {
    id: 'APP-104',
    name: 'Dr. Maya Perera',
    role: 'Doctor',
    organization: 'Lakeside Clinic',
    registration: 'SLMC-12345',
    status: 'Pending',
    evidence: [
      {
        name: 'Identity document',
        fileName: 'sample-identity.pdf',
        uploadedAt: '2026-11-02T09:30:00+05:30',
      },
      {
        name: 'SLMC registration evidence',
        fileName: 'sample-slmc.pdf',
        uploadedAt: '2026-11-02T09:30:00+05:30',
      },
    ],
    history: [],
  },
  {
    id: 'APP-105',
    name: 'Kavindi Silva',
    role: 'Pharmacist',
    organization: 'Lakeside Pharmacy',
    registration: 'PH-2045',
    status: 'Pending',
    evidence: [
      {
        name: 'Identity document',
        fileName: 'sample-identity.pdf',
        uploadedAt: '2026-11-03T13:00:00+05:30',
      },
      {
        name: 'Professional registration evidence',
        fileName: 'sample-registration.pdf',
        uploadedAt: '2026-11-03T13:00:00+05:30',
      },
    ],
    history: [],
  },
  {
    id: 'APP-106',
    name: 'Amara Fernando',
    role: 'Lab Staff',
    organization: 'Central Laboratory',
    registration: 'LAB-332',
    status: 'Under review',
    evidence: [
      {
        name: 'Identity document',
        fileName: 'sample-identity.pdf',
        uploadedAt: '2026-11-03T10:00:00+05:30',
      },
      {
        name: 'Laboratory association evidence',
        fileName: 'sample-lab-association.pdf',
        uploadedAt: '2026-11-04T09:00:00+05:30',
      },
    ],
    history: [
      {
        decision: 'Information requested',
        reviewer: 'Demo reviewer',
        decidedAt: '2026-11-03T11:30:00+05:30',
        reason: 'Please provide a current laboratory association letter.',
      },
    ],
  },
];

export function canReview(status: ApplicationStatus): boolean {
  return status === 'Pending' || status === 'Under review';
}

@Injectable({ providedIn: 'root' })
export class ProfessionalApplicationsService {
  // ML-55 will supply authenticated reviewer identity, server timestamps and private evidence access.
  private applications = sampleApplications;

  list() {
    return timer(250).pipe(map(() => this.applications));
  }

  get(id: string) {
    return timer(250).pipe(map(() => this.find(id)));
  }

  recordDecision(id: string, decision: ApplicationDecision, reason: string) {
    return timer(250).pipe(
      map(() => {
        const application = this.find(id);
        const trimmedReason = reason.trim();
        if (!canReview(application.status) || !trimmedReason || trimmedReason.length > 1000) {
          throw new Error('The application cannot accept this decision.');
        }

        const updated: ProfessionalApplication = {
          ...application,
          status: decision,
          history: [
            {
              decision,
              reason: trimmedReason,
              reviewer: 'Demo reviewer',
              decidedAt: new Date().toISOString(),
            },
            ...application.history,
          ],
        };
        this.applications = this.applications.map((item) => (item.id === id ? updated : item));
        return updated;
      }),
    );
  }

  private find(id: string): ProfessionalApplication {
    const application = this.applications.find((item) => item.id === id);
    if (!application) {
      throw new Error('Application not found.');
    }
    return application;
  }
}
