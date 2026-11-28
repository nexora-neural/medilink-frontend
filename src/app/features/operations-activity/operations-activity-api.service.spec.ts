import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { OperationsActivityApiService, mapJob } from './operations-activity-api.service';
import { JobResponse } from './operations-activity.models';
describe('OperationsActivityApiService', () => {
  const auth = { getAuthorized: vi.fn(), getOwnProfile: vi.fn(), postAuthorizedWithKey: vi.fn() };
  let api: OperationsActivityApiService;
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    api = TestBed.inject(OperationsActivityApiService);
  });
  it('encodes audit filters and pagination', async () => {
    await api.audit(2, '  job.retry.requested & other  ');
    const url = new URL(auth.getAuthorized.mock.calls[0][0], 'https://test.invalid');
    expect(url.pathname).toBe('/admin/audit-events');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('action')).toBe('job.retry.requested & other');
  });
  it('loads only the backend UUID returned by /me', async () => {
    auth.getOwnProfile.mockResolvedValue({ user: { id: 'own-user-id' } });
    await api.activity(3);
    expect(auth.getAuthorized).toHaveBeenCalledWith(
      '/patients/own-user-id/activity?page=3&page_size=20',
    );
  });
  it('does not request activity when profile authorization fails', async () => {
    auth.getOwnProfile.mockRejectedValue({ status: 403 });
    await expect(api.activity()).rejects.toEqual({ status: 403 });
    expect(auth.getAuthorized).not.toHaveBeenCalled();
  });
  it('passes the same retry key and trimmed reason to the authorized helper', async () => {
    await api.retry('job/id', '  Recheck  ', 'stable-key');
    expect(auth.postAuthorizedWithKey).toHaveBeenCalledWith(
      '/admin/jobs/job%2Fid/retry',
      { reason: 'Recheck' },
      'stable-key',
    );
  });
  it('loads summary, jobs and backup evidence from real endpoints', async () => {
    await api.summary();
    await api.jobs(2);
    await api.backups(3);
    expect(auth.getAuthorized.mock.calls.map((call) => call[0])).toEqual([
      '/admin/operations',
      '/admin/jobs?page=2&page_size=20',
      '/admin/backups?page=3&page_size=20',
    ]);
  });
  it('limits UI retry eligibility to supported failed jobs below the backend bound', () => {
    const job: JobResponse = {
      id: 'j',
      job_type: 'operations.database_check',
      status: 'failed',
      attempt_count: 1,
      error_code: null,
      updated_at: '',
    };
    expect(mapJob(job).retryable).toBe(true);
    expect(mapJob({ ...job, attempt_count: 3 }).retryable).toBe(false);
    expect(mapJob({ ...job, job_type: 'notification.delivery' }).retryable).toBe(false);
    expect(mapJob({ ...job, status: 'pending' })).toMatchObject({
      status: 'Queued',
      retryable: false,
      attempts: 1,
    });
    for (const status of ['running', 'succeeded', 'cancelled'] as const)
      expect(mapJob({ ...job, status }).retryable).toBe(false);
  });
});
