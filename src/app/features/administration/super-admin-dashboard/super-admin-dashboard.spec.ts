import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { ActiveRoleService } from '../../../core/context/active-role.service';
import { SuperAdminDashboard } from './super-admin-dashboard';

describe('SuperAdminDashboard', () => {
  let fixture: ComponentFixture<SuperAdminDashboard>;
  let roles: ActiveRoleService;
  let pendingTotal: number;
  let failWith: unknown;
  const getAuthorized = vi.fn();

  beforeEach(() => {
    pendingTotal = 12;
    failWith = undefined;
    getAuthorized.mockReset().mockImplementation(async (path: string) => {
      if (path.startsWith('/admin/organizations?')) {
        return {
          items: pendingTotal
            ? [{ id: 'org-1', name: 'Central Laboratory', type: 'laboratory', status: 'pending' }]
            : [],
          total: pendingTotal,
        };
      }
      if (path.startsWith('/admin/integration-clients?')) {
        return { items: [{ credential: 'PRIVATE-KEY' }], total: 18 };
      }
      if (path === '/admin/operations') {
        if (failWith !== undefined) throw failWith;
        return {
          active_organizations: 25,
          pending_verifications: 4,
          failed_jobs: 2,
          last_backup_at: null,
        };
      }
      if (path.startsWith('/admin/audit-events?')) {
        const action = new URL(path, 'http://test.local').searchParams.get('action');
        return {
          total: pendingTotal && action === 'integration_client.created' ? 1 : 0,
          items:
            pendingTotal && action === 'integration_client.created'
              ? [
                  {
                    id: 'a1',
                    action: 'clinical_note.created',
                    created_at: '2026-11-24T12:00:00Z',
                    metadata: { note: 'PRIVATE-CLINICAL' },
                  },
                  {
                    id: 'a2',
                    action: 'integration_client.created',
                    created_at: '2026-11-24T11:00:00Z',
                    actor_user_id: 'PRIVATE-ACTOR',
                    target_id: 'PRIVATE-TARGET',
                  },
                ]
              : [],
        };
      }
      throw new Error('Unexpected dashboard request');
    });

    TestBed.configureTestingModule({
      imports: [SuperAdminDashboard],
      providers: [provideRouter([]), { provide: AuthService, useValue: { getAuthorized } }],
    });
    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('super-admin-1', ['super_admin', 'patient']);
    roles.setActiveRole('Super Admin');
    fixture = TestBed.createComponent(SuperAdminDashboard);
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function settle(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.componentInstance.state().kind).not.toBe('loading');
    });
  }

  it('loads the protected endpoints and renders only the projected operational data', async () => {
    fixture.detectChanges();
    expect(text()).toContain('Loading dashboard');
    await settle();

    expect(getAuthorized.mock.calls.flat()).toEqual([
      '/admin/organizations?status=pending&page=1&page_size=5',
      '/admin/integration-clients?page=1&page_size=1',
      '/admin/operations',
      ...[
        'organization.decision',
        'membership.decision',
        'integration_client.created',
        'integration_client.credential_rotated',
        'integration_client.suspended',
        'integration_client.revoked',
        'account.admin.appointed',
        'account.admin.revoked',
        'job.retry.requested',
        'job.retry.completed',
        'job.retry.cancelled',
        'backup.run',
      ].map((action) => `/admin/audit-events?action=${action}&page=1&page_size=3`),
    ]);
    const values = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('app-dashboard-stat strong'),
    ].map((element) => element.textContent?.trim());
    expect(values).toEqual(['12', '18', '25', '2']);
    expect(text()).toContain('Integration client created');
    expect(text()).toContain('No successful backup recorded');
    expect(text()).not.toMatch(/PRIVATE-|clinical_note|Sample preview/);
    expect(fixture.nativeElement.querySelector('.organization-row').getAttribute('href')).toBe(
      '/super-admin/organizations/org-1',
    );
    expect(
      fixture.nativeElement.querySelector('a[href="/super-admin/integrations"]'),
    ).not.toBeNull();
  });

  it('refreshes data and displays empty results', async () => {
    await settle();
    pendingTotal = 0;
    (fixture.nativeElement.querySelector('.heading button') as HTMLButtonElement).click();
    await settle();
    expect(getAuthorized).toHaveBeenCalledTimes(30);
    expect(text()).toContain('No organizations awaiting review');
    expect(text()).toContain('No recent administrative activity');
    expect(text()).not.toContain('Central Laboratory');
  });

  it('blocks requests for a non-Super Admin active role despite holding that entitlement', async () => {
    roles.setActiveRole('Patient');
    await settle();
    expect(text()).toContain('Access denied');
    expect(getAuthorized).not.toHaveBeenCalled();
  });

  it('hides old data and discards a delayed response after the account changes', async () => {
    let resolveOperations!: (data: unknown) => void;
    getAuthorized
      .mockImplementationOnce(() => Promise.resolve({ items: [], total: 50 }))
      .mockImplementationOnce(() => Promise.resolve({ total: 50 }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOperations = resolve;
          }),
      )
      .mockImplementationOnce(() => Promise.resolve({ items: [] }));

    fixture.detectChanges();
    expect(text()).toContain('Loading dashboard');
    roles.setAccountRoles('super-admin-2', ['super_admin']);
    await settle();
    resolveOperations({
      active_organizations: 999,
      failed_jobs: 0,
      pending_verifications: 0,
      last_backup_at: null,
    });
    await settle();
    expect(text()).toContain('Central Laboratory');
    expect(text()).not.toContain('999');

    roles.clear();
    fixture.detectChanges();
    expect(text()).toContain('Access denied');
    expect(text()).not.toContain('Central Laboratory');
  });

  it.each([
    [401, 'Session expired'],
    [403, 'Access denied'],
    [503, 'Dashboard unavailable'],
  ])('handles API status %i without rendering partial records', async (status, message) => {
    failWith = new HttpErrorResponse({ status, error: { message: 'PRIVATE-ERROR' } });
    await settle();
    expect(text()).toContain(message);
    expect(text()).not.toMatch(/Central Laboratory|PRIVATE-ERROR/);
    if (status === 401)
      expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('allows recovery from a service failure using Try again', async () => {
    failWith = new HttpErrorResponse({ status: 503 });
    await settle();
    failWith = undefined;
    (fixture.nativeElement.querySelector('app-ui-state button') as HTMLButtonElement).click();
    await settle();
    expect(text()).toContain('Central Laboratory');
    expect(text()).not.toContain('Dashboard unavailable');
  });

  it('recognizes a Firebase session that expired before an API request', async () => {
    failWith = Object.assign(new Error('Authentication failed'), {
      code: 'auth/user-token-expired',
    });
    await settle();
    expect(text()).toContain('Session expired');
  });
});
