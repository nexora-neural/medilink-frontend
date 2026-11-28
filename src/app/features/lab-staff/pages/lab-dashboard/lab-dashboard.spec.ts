import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, MeResponse } from '../../../../core/auth.service';
import { ActiveOrganizationService } from '../../../../core/context/active-organization.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { ReportApi, SavedReport } from '../../../reports/services/report-api.service';
import { LabDashboard } from './lab-dashboard';

const me: MeResponse = {
  user: { id: 'staff', display_name: 'Test Staff', email: null, phone: null, status: 'active' },
  roles: ['lab_staff'],
  memberships: [
    {
      id: 'membership',
      organization_id: 'lab',
      user_id: 'staff',
      role: 'lab_staff',
      status: 'approved',
      verified_at: null,
      created_at: '2026-11-28T00:00:00Z',
    },
  ],
  patient_profile: null,
  professional_profile: {
    user_id: 'staff',
    role: 'lab_staff',
    doctor_reference: null,
    registration_number: null,
    workplace: null,
    qualifications: null,
    specialty: null,
    verification_status: 'approved',
    created_at: '2026-11-28T00:00:00Z',
    updated_at: '2026-11-28T00:00:00Z',
  },
};

const report: SavedReport = {
  id: 'report',
  patient_user_id: 'patient',
  laboratory_id: 'lab',
  document_id: 'document',
  report_type: 'FBC',
  report_date: null,
  lab_reference: null,
  notes: null,
  source: 'laboratory',
  status: 'active',
  created_at: '2026-11-28T00:00:00Z',
};

const page = { items: [report], page: 1, page_size: 20, total: 27 };

describe('LabDashboard API integration', () => {
  const getAuthorized = vi.fn();
  const list = vi.fn();

  beforeEach(async () => {
    getAuthorized.mockReset().mockResolvedValue(structuredClone(me));
    list.mockReset().mockResolvedValue(structuredClone(page));

    await TestBed.configureTestingModule({
      imports: [LabDashboard],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getAuthorized } },
        { provide: ReportApi, useValue: { list } },
      ],
    }).compileComponents();

    TestBed.inject(ActiveRoleService).setAccountRoles('staff', ['lab_staff']);
  });

  async function render() {
    const fixture = TestBed.createComponent(LabDashboard);
    fixture.detectChanges();

    await vi.waitFor(() => expect(fixture.componentInstance.state()).not.toBe('loading'));

    fixture.detectChanges();
    await fixture.whenStable();

    return fixture;
  }

  it('loads real identity, server total and mapped recent reports', async () => {
    const fixture = await render();

    expect(getAuthorized).toHaveBeenCalledWith('me');
    expect(list).toHaveBeenCalledWith(null, 1);
    expect(fixture.componentInstance.summary().totalReports).toBe(27);

    expect(fixture.componentInstance.reports()[0]).toMatchObject({
      date: '2026-11-28',
      reference: 'No reference',
      status: 'Published',
    });

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Welcome, Test');
    expect(element.textContent).toContain('FBC');
    expect(element.textContent).not.toContain('Demo data');
    expect(element.textContent).not.toContain('Open sample requests');

    expect(element.querySelector('a.primary')?.getAttribute('href')).toBe(
      '/workspace/lab-staff/upload-requests',
    );
  });

  it('handles an empty server list', async () => {
    list.mockResolvedValue({ ...page, items: [], total: 0 });

    const fixture = await render();

    expect(fixture.componentInstance.state()).toBe('empty');
    expect(fixture.nativeElement.textContent).toContain('No reports uploaded yet.');
  });

  it.each([401, 403, 503])('handles HTTP %s and clears report data', async (status) => {
    list.mockRejectedValue(new HttpErrorResponse({ status }));

    const fixture = await render();

    expect(fixture.componentInstance.state()).toBe(
      status === 401 ? 'expired' : status === 403 ? 'denied' : 'error',
    );
    expect(fixture.componentInstance.reports()).toEqual([]);
  });

  it('handles a missing Firebase session', async () => {
    getAuthorized.mockRejectedValue(new Error('Please sign in to continue.'));

    const fixture = await render();

    expect(fixture.componentInstance.state()).toBe('expired');
    expect(list).not.toHaveBeenCalled();
  });

  it('denies pending verification before fetching reports', async () => {
    const pending = structuredClone(me);
    pending.professional_profile!.verification_status = 'pending';
    getAuthorized.mockResolvedValue(pending);

    const fixture = await render();

    expect(fixture.componentInstance.state()).toBe('denied');
    expect(list).not.toHaveBeenCalled();
  });

  it('hides loaded information immediately when the active role changes', async () => {
    const fixture = await render();

    TestBed.inject(ActiveRoleService).setAccountRoles('patient', ['patient']);

    expect(fixture.componentInstance.reports()).toEqual([]);
    expect(fixture.componentInstance.state()).toBe('denied');

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('FBC');
    expect(fixture.nativeElement.querySelector('app-lab-summary-cards')).toBeNull();
  });

  it('ignores a response arriving after the account changes', async () => {
    let resolve!: (value: typeof page) => void;

    list.mockImplementation(
      () =>
        new Promise<typeof page>((done) => {
          resolve = done;
        }),
    );

    const fixture = TestBed.createComponent(LabDashboard);
    fixture.detectChanges();

    await Promise.resolve();

    expect(list).toHaveBeenCalled();

    TestBed.inject(ActiveRoleService).setAccountRoles('other', ['lab_staff']);

    resolve(page);
    await fixture.whenStable();

    expect(fixture.componentInstance.reports()).toEqual([]);
    expect(fixture.componentInstance.firstName()).toBe('Lab Staff');
  });

  it('reloads after a service failure', async () => {
    list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    const fixture = await render();

    expect(fixture.componentInstance.state()).toBe('error');

    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.state()).toBe('ready');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('reloads when the selected laboratory changes', async () => {
    const organizations = TestBed.inject(ActiveOrganizationService);
    organizations.setAccountMemberships('staff', me.memberships);

    const fixture = await render();

    organizations.selectOrganization('lab');

    expect(fixture.componentInstance.reports()).toEqual([]);

    fixture.detectChanges();

    await vi.waitFor(() => expect(fixture.componentInstance.state()).toBe('ready'));

    expect(list).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.state()).toBe('ready');
  });
});
