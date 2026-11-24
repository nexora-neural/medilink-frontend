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
  pendingByRole: { doctor: 1, pharmacist: 0, lab_staff: 0 },
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
        pendingByRole: { doctor: 0, pharmacist: 0, lab_staff: 0 },
      }),
    );
    expect(element.textContent).toContain('No failed jobs');
    expect(element.textContent).toContain('Active organizations');
    expect(element.textContent).toContain('Open account support');
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

describe('dashboard review regressions', () => {
  it.each(['auth/user-token-expired', 'auth/id-token-expired', 'TOKEN_EXPIRED'])(
    'offers sign-in for Firebase expiry %s',
    async (code) => {
      await TestBed.configureTestingModule({
        imports: [AdminDashboard],
        providers: [
          provideRouter([]),
          { provide: AdminDashboardService, useValue: { load: () => Promise.reject({ code }) } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(AdminDashboard);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Session expired');
      expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
    },
  );
  it('keeps operations and actions visible when the lists are empty', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        {
          provide: AdminDashboardService,
          useValue: {
            load: () =>
              Promise.resolve({
                ...sample,
                summary: { ...sample.summary, active_organizations: 1 },
                pendingByRole: { doctor: 0, pharmacist: 0, lab_staff: 0 },
              }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Active organizations');
    expect(fixture.nativeElement.querySelector('.summary-list').textContent).toContain('1');
    expect(fixture.nativeElement.textContent).toContain('Open account support');
  });
});
