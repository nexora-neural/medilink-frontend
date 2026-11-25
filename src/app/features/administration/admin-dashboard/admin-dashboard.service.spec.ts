import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  it('uses filtered server totals for each pending role even when the first unfiltered page would omit older applications', async () => {
    const getAuthorized = vi.fn(async (path: string) => {
      if (path === 'admin/operations')
        return {
          pending_verifications: 1,
          active_organizations: 0,
          failed_jobs: 0,
          last_backup_at: null,
        };
      if (path.includes('verification-applications')) {
        expect(path).toContain('status=pending');
        expect(path).toContain('page_size=1');
        return { items: [], page: 1, page_size: 1, total: path.includes('role=doctor') ? 1 : 0 };
      }
      return { items: [], page: 1, page_size: 10, total: 0 };
    });
    TestBed.configureTestingModule({
      providers: [AdminDashboardService, { provide: AuthService, useValue: { getAuthorized } }],
    });
    const data = await TestBed.inject(AdminDashboardService).load();
    expect(data.pendingByRole).toEqual({ doctor: 1, pharmacist: 0, lab_staff: 0 });
    expect(getAuthorized).toHaveBeenCalledWith(
      'admin/verification-applications?page=1&page_size=1&status=pending&role=doctor',
    );
    expect(getAuthorized).toHaveBeenCalledWith(
      'admin/verification-applications?page=1&page_size=1&status=pending&role=pharmacist',
    );
    expect(getAuthorized).toHaveBeenCalledWith(
      'admin/verification-applications?page=1&page_size=1&status=pending&role=lab_staff',
    );
  });
});
