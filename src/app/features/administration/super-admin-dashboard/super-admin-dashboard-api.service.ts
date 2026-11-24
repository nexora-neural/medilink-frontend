import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import type { Organization } from '../organizations/organizations.service';

interface Page<T> {
  items: T[];
  total: number;
}

interface OperationalSummary {
  active_organizations: number;
  pending_verifications: number;
  failed_jobs: number;
  last_backup_at: string | null;
}

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
}

const activityLabels = new Map([
  ['organization.decision', 'Organization reviewed'],
  ['membership.decision', 'Membership reviewed'],
  ['integration_client.created', 'Integration client created'],
  ['integration_client.credential_rotated', 'Integration credential rotated'],
  ['integration_client.suspended', 'Integration client suspended'],
  ['integration_client.revoked', 'Integration client revoked'],
  ['account.admin.appointed', 'Admin appointed'],
  ['account.admin.revoked', 'Admin access revoked'],
  ['job.retry.requested', 'Job retry requested'],
  ['job.retry.completed', 'Job retry completed'],
  ['job.retry.cancelled', 'Job retry cancelled'],
  ['backup.run', 'Backup run recorded'],
]);

type OrganizationSummary = Pick<Organization, 'id' | 'name' | 'type' | 'status'>;

export interface DashboardSnapshot {
  organizations: OrganizationSummary[];
  pendingOrganizations: number;
  activeOrganizations: number;
  integrationClients: number;
  failedJobs: number;
  pendingVerifications: number;
  lastBackupAt: string | null;
  activity: { id: string; label: string; createdAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class SuperAdminDashboardApiService {
  private readonly auth = inject(AuthService);

  async load(): Promise<DashboardSnapshot> {
    const [organizations, clients, operations, audit] = await Promise.all([
      this.auth.getAuthorized<Page<OrganizationSummary>>(
        '/admin/organizations?status=pending&page=1&page_size=5',
      ),
      this.auth.getAuthorized<Pick<Page<never>, 'total'>>(
        '/admin/integration-clients?page=1&page_size=1',
      ),
      this.auth.getAuthorized<OperationalSummary>('/admin/operations'),
      this.auth.getAuthorized<Page<AuditEvent>>('/admin/audit-events?page=1&page_size=20'),
    ]);

    return {
      organizations: organizations.items.map(({ id, name, type, status }) => ({
        id,
        name,
        type,
        status,
      })),
      pendingOrganizations: organizations.total,
      activeOrganizations: operations.active_organizations,
      integrationClients: clients.total,
      failedJobs: operations.failed_jobs,
      pendingVerifications: operations.pending_verifications,
      lastBackupAt: operations.last_backup_at,
      activity: audit.items
        .flatMap(({ id, action, created_at }) => {
          const label = activityLabels.get(action);
          return label ? [{ id, label, createdAt: created_at }] : [];
        })
        .slice(0, 3),
    };
  }
}
