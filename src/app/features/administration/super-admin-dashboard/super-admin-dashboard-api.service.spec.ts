import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth.service';
import { SuperAdminDashboardApiService } from './super-admin-dashboard-api.service';

interface EventFixture {
  id: string;
  action: string;
  created_at: string;
  metadata?: unknown;
}
const event = (id: string, action: string, created_at: string): EventFixture => ({
  id,
  action,
  created_at,
});

describe('Super Admin dashboard administrative activity queries', () => {
  let events: EventFixture[];
  let api: SuperAdminDashboardApiService;
  let failure: HttpErrorResponse | undefined;
  const getAuthorized = vi.fn();
  beforeEach(() => {
    events = [];
    failure = undefined;
    getAuthorized.mockReset().mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test.local');
      if (url.pathname === '/admin/audit-events') {
        if (failure) throw failure;
        // Match backend semantics: exact action filter, THEN newest-first pagination.
        const action = url.searchParams.get('action');
        const matching = events
          .filter((e) => !action || e.action === action)
          .sort((a, b) => {
            return Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? 1 : -1);
          });
        const page = Number(url.searchParams.get('page'));
        const size = Number(url.searchParams.get('page_size'));
        return { items: matching.slice((page - 1) * size, page * size), total: matching.length };
      }
      if (url.pathname === '/admin/organizations') return { items: [], total: 0 };
      if (url.pathname === '/admin/integration-clients') return { total: 0 };
      if (url.pathname === '/admin/operations')
        return {
          active_organizations: 0,
          pending_verifications: 0,
          failed_jobs: 0,
          last_backup_at: null,
        };
      throw new Error('Unexpected request');
    });
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getAuthorized } }],
    });
    api = TestBed.inject(SuperAdminDashboardApiService);
  });
  function noise(count: number): EventFixture[] {
    return Array.from({ length: count }, (_, index) =>
      event(
        'request-' + index,
        'api.request',
        new Date(Date.UTC(2026, 10, 25, 12, 0, index)).toISOString(),
      ),
    );
  }
  it('finds older administrative events behind more than 20 newer non-matching audit events', async () => {
    events = [...noise(45), event('admin-older', 'organization.decision', '2026-11-25T11:00:00Z')];
    // The old unfiltered first page really would contain no matching admin event.
    const firstPage = [...events]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 20);
    expect(firstPage.every((e) => e.action === 'api.request')).toBe(true);
    expect((await api.load()).activity).toEqual([
      { id: 'admin-older', label: 'Organization reviewed', createdAt: '2026-11-25T11:00:00Z' },
    ]);
    const auditCalls = getAuthorized.mock.calls
      .map(([path]) => new URL(path, 'http://test.local'))
      .filter((url) => url.pathname === '/admin/audit-events');
    expect(auditCalls).toHaveLength(12);
    expect(
      auditCalls.every(
        (url) =>
          !!url.searchParams.get('action') &&
          url.searchParams.get('page') === '1' &&
          url.searchParams.get('page_size') === '3',
      ),
    ).toBe(true);
  });
  it('merges the latest matches across action types in global newest-first order, limited to three', async () => {
    events = [
      event('old', 'backup.run', '2026-11-25T09:00:00Z'),
      event('second', 'organization.decision', '2026-11-25T11:59:00Z'),
      event('first', 'integration_client.created', '2026-11-25T12:00:00Z'),
      event('third', 'membership.decision', '2026-11-25T11:58:00Z'),
      ...noise(50),
    ];
    expect((await api.load()).activity.map((e) => e.id)).toEqual(['first', 'second', 'third']);
  });
  it('can fill all three positions from one action without paging through unrelated events', async () => {
    events = [
      ...noise(100),
      ...[0, 1, 2, 3, 4].map((n) => event('admin-' + n, 'backup.run', `2026-11-25T10:0${n}:00Z`)),
    ];
    expect((await api.load()).activity.map((e) => e.id)).toEqual(['admin-4', 'admin-3', 'admin-2']);
    expect(getAuthorized).toHaveBeenCalledTimes(15);
  });
  it('uses descending id for matching timestamps, consistent with backend ordering', async () => {
    events = [
      event('a', 'backup.run', '2026-11-25T12:00:00Z'),
      event('c', 'organization.decision', '2026-11-25T12:00:00Z'),
      event('b', 'membership.decision', '2026-11-25T12:00:00Z'),
    ];
    expect((await api.load()).activity.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
  it('returns an actual empty state when only non-administrative events exist', async () => {
    events = noise(100);
    expect((await api.load()).activity).toEqual([]);
    expect(getAuthorized).toHaveBeenCalledTimes(15);
  });
  it('projects only allowlisted labels, ids and times, excluding raw metadata', async () => {
    events = [
      {
        ...event('safe', 'account.admin.appointed', '2026-11-25T12:00:00Z'),
        metadata: { credential: 'PRIVATE-CREDENTIAL', patient: 'PRIVATE-PATIENT' },
      },
    ];
    const snapshot = await api.load();
    expect(snapshot.activity).toEqual([
      { id: 'safe', label: 'Admin appointed', createdAt: '2026-11-25T12:00:00Z' },
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE|metadata|account.admin.appointed/);
  });
  it.each([401, 403, 503])(
    'propagates audit failure %i instead of reporting a false empty list',
    async (status) => {
      failure = new HttpErrorResponse({ status });
      await expect(api.load()).rejects.toBe(failure);
    },
  );
  it('reloads activity on refresh rather than caching a previous empty result', async () => {
    expect((await api.load()).activity).toEqual([]);
    events.push(event('new', 'job.retry.completed', '2026-11-25T12:00:00Z'));
    expect((await api.load()).activity.map((e) => e.id)).toEqual(['new']);
  });
});
