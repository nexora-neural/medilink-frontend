import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardService, AdminDashboardData } from './admin-dashboard.service';
import { AdminDashboard } from './admin-dashboard';

const sample: AdminDashboardData = {
  summary: {
    pending_verifications: 2,
    active_organizations: 4,
    failed_jobs: 1,
    last_backup_at: null,
  },
  applications: {
    items: [
      {
        id: '1',
        user_id: 'u1',
        organization_id: null,
        role: 'doctor',
        registration_number: null,
        status: 'pending',
        submitted_at: '',
        reviewed_by: null,
        reviewed_at: null,
        review_reason: null,
        evidence_document_ids: [],
        applicant_display_name: null,
        organization_name: null,
      },
      {
        id: '2',
        user_id: 'u2',
        organization_id: null,
        role: 'pharmacist',
        registration_number: null,
        status: 'approved',
        submitted_at: '',
        reviewed_by: null,
        reviewed_at: null,
        review_reason: null,
        evidence_document_ids: [],
        applicant_display_name: null,
        organization_name: null,
      },
    ],
    page: 1,
    page_size: 100,
    total: 2,
  },
  jobs: { items: [], page: 1, page_size: 20, total: 0 },
  auditEvents: { items: [], page: 1, page_size: 10, total: 0 },
  backups: { items: [], page: 1, page_size: 10, total: 0 },
};

describe('AdminDashboard', () => {
  let fixture: ComponentFixture<AdminDashboard>;
  let element: HTMLElement;
  let load: ReturnType<typeof vi.fn>;

  async function setup(result: Promise<AdminDashboardData>): Promise<void> {
    load = vi.fn().mockReturnValue(result);
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([]), { provide: AdminDashboardService, useValue: { load } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement;
  }

  it('shows API backed summaries and operations without sample content', async () => {
    await setup(Promise.resolve(sample));
    expect(element.querySelector('.count')?.textContent?.trim()).toBe('2');
    expect(element.textContent).toContain('Active organizations');
    expect(element.textContent).toContain('Review applications');
    expect(element.textContent).not.toContain('Sample preview');
  });

  it('shows empty state for an empty API response', async () => {
    await setup(
      Promise.resolve({
        ...sample,
        summary: {
          ...sample.summary,
          pending_verifications: 0,
          active_organizations: 0,
          failed_jobs: 0,
        },
        applications: { ...sample.applications, items: [], total: 0 },
      }),
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'No administrative activity',
    );
  });

  it('shows permission denied for a forbidden API response', async () => {
    await setup(Promise.reject({ status: 403 }));
    expect(element.textContent).toContain('Access not permitted');
  });

  it('shows the expired-session state for an unauthorized API response', async () => {
    await setup(Promise.reject({ status: 401 }));
    expect(element.textContent).toContain('Session expired');
  });

  it('shows a service error and retries the API load', async () => {
    await setup(Promise.reject({ status: 503 }));
    expect(element.textContent).toContain('Dashboard unavailable');
    load.mockReturnValue(Promise.resolve(sample));
    element.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.count')?.textContent?.trim()).toBe('2');
  });
});
