import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { AccountSupportApiService } from './account-support-api.service';

describe('AccountSupportApiService', () => {
  let service: AccountSupportApiService;

  let auth: {
    getAuthorized: ReturnType<typeof vi.fn>;
    postAuthorized: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      getAuthorized: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        page_size: 20,
        total: 0,
      }),
      postAuthorized: vi.fn().mockResolvedValue({}),
    };

    TestBed.configureTestingModule({
      providers: [AccountSupportApiService, { provide: AuthService, useValue: auth }],
    });

    service = TestBed.inject(AccountSupportApiService);
  });

  it('searches with pagination and a trimmed, encoded query', async () => {
    const response = {
      items: [],
      page: 2,
      page_size: 20,
      total: 25,
    };
    auth.getAuthorized.mockResolvedValue(response);

    const result = await service.searchUsers('  Alex & Sam  ', 2);

    const path = auth.getAuthorized.mock.calls[0][0] as string;
    const url = new URL(path, 'https://example.test');

    expect(url.pathname).toBe('/admin/users');
    expect(url.searchParams.get('q')).toBe('Alex & Sam');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.has('status')).toBe(false);
    expect(auth.getAuthorized).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('omits a blank query and uses the first page by default', async () => {
    await service.searchUsers('   ');

    const path = auth.getAuthorized.mock.calls[0][0] as string;
    const url = new URL(path, 'https://example.test');

    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('20');
  });

  it('includes the requested status filter', async () => {
    await service.searchUsers('', 1, 'suspended');

    const path = auth.getAuthorized.mock.calls[0][0] as string;
    const url = new URL(path, 'https://example.test');

    expect(url.searchParams.get('status')).toBe('suspended');
  });

  it('posts a status decision with a trimmed reason', async () => {
    const response = { id: 'sample-user', status: 'suspended' };
    auth.postAuthorized.mockResolvedValue(response);

    const result = await service.updateStatus('sample-user', 'suspended', '  Review required  ');

    expect(auth.postAuthorized).toHaveBeenCalledExactlyOnceWith('/admin/users/sample-user/status', {
      status: 'suspended',
      reason: 'Review required',
    });
    expect(result).toBe(response);
  });

  it('posts an Admin appointment with the required role', async () => {
    await service.appointAdmin('sample-user', '  Appointment approved  ');

    expect(auth.postAuthorized).toHaveBeenCalledExactlyOnceWith('/admin/role-assignments', {
      user_id: 'sample-user',
      role: 'admin',
      reason: 'Appointment approved',
    });
  });

  it('posts an Admin revocation with only the reason', async () => {
    await service.revokeAdmin('sample-user', '  Access no longer required  ');

    expect(auth.postAuthorized).toHaveBeenCalledExactlyOnceWith(
      '/admin/users/sample-user/admin-role/revoke',
      {
        reason: 'Access no longer required',
      },
    );
  });

  it('encodes account IDs used in URL paths', async () => {
    await service.updateStatus('user/other', 'active', 'Reviewed');
    await service.revokeAdmin('user/other', 'Reviewed');

    expect(auth.postAuthorized).toHaveBeenNthCalledWith(1, '/admin/users/user%2Fother/status', {
      status: 'active',
      reason: 'Reviewed',
    });
    expect(auth.postAuthorized).toHaveBeenNthCalledWith(
      2,
      '/admin/users/user%2Fother/admin-role/revoke',
      { reason: 'Reviewed' },
    );
  });

  it('propagates search errors to the caller', async () => {
    const error = new Error('Service unavailable');
    auth.getAuthorized.mockRejectedValue(error);

    await expect(service.searchUsers('Sample')).rejects.toBe(error);
  });

  it('propagates decision errors without retrying the mutation', async () => {
    const error = new Error('Permission denied');
    auth.postAuthorized.mockRejectedValue(error);

    await expect(service.appointAdmin('sample-user', 'Appointment approved')).rejects.toBe(error);

    expect(auth.postAuthorized).toHaveBeenCalledOnce();
  });
});
