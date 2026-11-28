import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsAuditPage } from './operations-audit-page';
import { OperationsActivityApiService } from '../../operations-activity-api.service';
const empty = { items: [], page: 1, page_size: 20, total: 0 };
const failed = {
  id: 'j',
  job_type: 'operations.database_check',
  status: 'failed',
  attempt_count: 1,
  error_code: 'JOB_FAILED',
  updated_at: '2026-11-28T00:00:00Z',
};
describe('OperationsAuditPage integration', () => {
  let page: OperationsAuditPage;
  const api = { summary: vi.fn(), audit: vi.fn(), jobs: vi.fn(), backups: vi.fn(), retry: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    api.summary.mockResolvedValue({
      pending_verifications: 2,
      active_organizations: 3,
      failed_jobs: 1,
      last_backup_at: null,
    });
    api.audit.mockResolvedValue(empty);
    api.jobs.mockResolvedValue({ ...empty, items: [failed], total: 1 });
    api.backups.mockResolvedValue(empty);
    TestBed.configureTestingModule({
      providers: [
        { provide: OperationsActivityApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { auditAudience: 'admin' } } } },
      ],
    });
    page = TestBed.runInInjectionContext(() => new OperationsAuditPage());
  });
  it('loads persisted data for a delegated admin and refreshes worker status', async () => {
    await page.refresh();
    expect(page.jobs()[0].status).toBe('Failed');
    expect(page.auditState()).toBe('empty');
    api.jobs.mockResolvedValue({
      ...empty,
      items: [{ ...failed, status: 'succeeded', attempt_count: 2 }],
    });
    await page.refresh();
    expect(page.jobs()[0]).toMatchObject({ status: 'Succeeded', attempts: 2, retryable: false });
  });
  it('isolates a failed backup service from successful job loading', async () => {
    api.backups.mockRejectedValue({ status: 503 });
    await page.refresh();
    expect(page.backupsState()).toBe('error');
    expect(page.backupEvidence()).toEqual([]);
    expect(page.jobsState()).toBe('ready');
  });
  it('clears stale audit information on denied access', async () => {
    api.audit.mockResolvedValue({
      ...empty,
      items: [
        {
          id: 'a',
          action: 'job.attempt',
          actor_user_id: null,
          actor_client_id: null,
          target_type: 'job_run',
          outcome: 'success',
          request_id: 'r',
          created_at: failed.updated_at,
        },
      ],
    });
    await page.loadAudit();
    expect(page.events()).toHaveLength(1);
    api.audit.mockRejectedValue({ status: 403 });
    await page.loadAudit();
    expect(page.events()).toEqual([]);
    expect(page.auditState()).toBe('error');
    expect(page.auditError()).toContain('permission');
  });
  it('retains the key after an uncertain failure and never increments attempts optimistically', async () => {
    await page.refresh();
    api.retry.mockRejectedValueOnce({ status: 0 });
    await page.retryJob({ id: 'j', reason: 'Recheck' });
    const key = api.retry.mock.calls[0][2];
    expect(page.jobs()[0].attempts).toBe(1);
    expect(page.retryError()).toBeTruthy();
    api.retry.mockResolvedValueOnce({ ...failed, status: 'pending' });
    await page.retryJob({ id: 'j', reason: 'Recheck' });
    expect(api.retry.mock.calls[1][2]).toBe(key);
    expect(page.jobs()[0]).toMatchObject({ status: 'Queued', attempts: 1, retryable: false });
  });
  it('blocks duplicate submissions while waiting and ignores unsupported jobs', async () => {
    await page.refresh();
    let resolve!: (value: unknown) => void;
    api.retry.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const first = page.retryJob({ id: 'j', reason: 'Recheck' });
    await page.retryJob({ id: 'j', reason: 'Recheck' });
    expect(api.retry).toHaveBeenCalledOnce();
    resolve({ ...failed, status: 'pending' });
    await first;
    await page.retryJob({ id: 'j', reason: 'Recheck' });
    expect(api.retry).toHaveBeenCalledOnce();
  });
  it('shows backup coverage and restore evidence without archive paths', async () => {
    api.backups.mockResolvedValue({
      ...empty,
      items: [
        {
          id: 'b',
          status: 'succeeded',
          database_included: true,
          files_included: false,
          started_at: failed.updated_at,
          finished_at: null,
          restore_check_status: 'not_run',
          restore_checked_at: null,
          error_code: null,
        },
      ],
    });
    await page.loadBackups();
    expect(page.backupEvidence()[0]).toMatchObject({
      coverage: 'Database: included · Files: not included',
      verification: 'Restore check: not run',
    });
  });

  it.each([
    ['audit', 'Audit activity'],
    ['jobs', 'Background jobs'],
    ['backups', 'Backup evidence'],
  ] as const)(
    'hides only %s pagination during loading and failure and restores it after recovery',
    async (method, label) => {
      api[method].mockResolvedValue({ ...empty, total: 44 });
      const fixture = TestBed.createComponent(OperationsAuditPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      const section = element.querySelector(`section[aria-label="${label}"]`)!;
      expect(section.querySelector('app-activity-page-controls')?.textContent).toContain(
        '44 results',
      );

      let reject!: (reason: unknown) => void;
      api[method].mockReturnValue(
        new Promise((_, rejectRequest) => {
          reject = rejectRequest;
        }),
      );
      const component = fixture.componentInstance;
      const reload = () =>
        method === 'audit'
          ? component.loadAudit()
          : method === 'jobs'
            ? component.loadJobs()
            : component.loadBackups();
      const loading = reload();
      fixture.detectChanges();
      expect(section.querySelector('app-activity-page-controls')).toBeNull();

      reject({ status: 503 });
      await loading;
      fixture.detectChanges();
      expect(section.querySelector('app-activity-page-controls')).toBeNull();
      expect(section.textContent).not.toContain('44 results');
      expect(section.textContent).toContain('Try again');
      expect(element.querySelectorAll('app-activity-page-controls')).toHaveLength(2);

      api[method].mockResolvedValue(empty);
      await reload();
      fixture.detectChanges();
      expect(section.querySelector('app-activity-page-controls')?.textContent).toContain(
        '0 results',
      );
      expect(element.querySelectorAll('app-activity-page-controls')).toHaveLength(3);
    },
  );

  it('retries the failed filter page instead of the previously displayed page', async () => {
    api.audit.mockResolvedValueOnce({ ...empty, page: 3, total: 60 });
    await page.loadAudit(3);

    expect(page.auditPage()).toBe(3);

    api.audit.mockRejectedValueOnce({ status: 503 });
    page.actionFilter = 'job.retry.requested';
    page.applyFilter();

    await vi.waitFor(() => {
      expect(page.auditState()).toBe('error');
    });

    expect(api.audit).toHaveBeenLastCalledWith(1, 'job.retry.requested');

    // Unsubmitted input must not change the filter being retried.
    page.actionFilter = 'job.retry.completed';
    api.audit.mockResolvedValueOnce(empty);

    // The template's Try again button calls loadAudit().
    await page.loadAudit();

    expect(api.audit).toHaveBeenLastCalledWith(1, 'job.retry.requested');
    expect(page.auditPage()).toBe(1);
    expect(page.auditState()).toBe('empty');
    expect(page.auditError()).toBe('');
  });

  it('ignores an older refresh response after a newer filter succeeds', async () => {
    let resolveOlder!: (value: unknown) => void;
    api.audit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOlder = resolve;
      }),
    );

    const olderRefresh = page.refresh();

    const currentRow = {
      id: 'current',
      action: 'job.retry.requested',
      actor_user_id: null,
      actor_client_id: null,
      target_type: 'job_run',
      target_id: null,
      outcome: 'success',
      request_id: 'current-request',
      metadata: {},
      created_at: '2026-11-28T00:00:00Z',
    };

    api.audit.mockResolvedValueOnce({
      ...empty,
      items: [currentRow],
      total: 1,
    });
    page.actionFilter = 'job.retry.requested';
    page.applyFilter();

    await vi.waitFor(() => {
      expect(page.events().map((row) => row.id)).toEqual(['current']);
    });

    resolveOlder({
      ...empty,
      page: 3,
      total: 60,
      items: [
        {
          ...currentRow,
          id: 'older',
          action: 'job.retry.completed',
        },
      ],
    });
    await olderRefresh;

    expect(page.events().map((row) => row.id)).toEqual(['current']);
    expect(page.auditPage()).toBe(1);
    expect(page.auditTotal()).toBe(1);
    expect(page.auditState()).toBe('ready');
    expect(page.auditError()).toBe('');
  });
});
