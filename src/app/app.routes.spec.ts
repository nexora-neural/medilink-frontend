import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ActiveRoleService } from './core/context/active-role.service';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';

describe('workspace routing', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: { restoreSession: vi.fn().mockResolvedValue(true) } },
      ],
    });
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-patient', ['patient']);
  });

  it('redirects an unauthenticated session to login', async () => {
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('does not open the workspace if session verification fails', async () => {
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockRejectedValue(
      new Error('unavailable'),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('opens an allowed role page and redirects a different role', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workspace');
    expect(harness.routeNativeElement?.textContent).toContain('Your care overview');
    expect(harness.routeNativeElement?.textContent).toContain('Sample preview only');

    await harness.navigateByUrl('/workspace/patient/medications');
    expect(harness.routeNativeElement?.textContent).toContain('Medications');
    expect(harness.routeNativeElement?.textContent).not.toContain('Your care overview');

    for (const [path, heading] of [
      ['/workspace/patient/prescriptions', 'Prescriptions'],
      ['/workspace/patient/history', 'Medical history'],
      ['/workspace/patient/reports', 'Reports'],
      ['/workspace/patient/measurements', 'Measurements'],
      ['/workspace/patient/vaccinations', 'Vaccinations'],
      ['/workspace/patient/access', 'Doctor access'],
    ]) {
      await harness.navigateByUrl(path);
      expect(harness.routeNativeElement?.textContent).toContain(heading);
      expect(harness.routeNativeElement?.textContent).not.toContain('Your care overview');
    }

    TestBed.inject(ActiveRoleService).setAccountRoles('demo-doctor', ['doctor']);
    await harness.navigateByUrl('/workspace/patient/reports');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Access denied');
  });

  it('sends the unimplemented verification documents route to not found', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/verification-documents');
    expect(TestBed.inject(Router).url).toBe('/not-found');
  });

  it('restricts the super admin preview to the selected admin role', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/organizations');
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    await harness.navigateByUrl('/super-admin/organizations');
    expect(harness.routeNativeElement?.textContent).toContain('Organizations and memberships');
  });

  it('reviews an application and keeps the decision in its history when reopened', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/applications');
    expect(TestBed.inject(Router).url).toBe('/access-denied');

    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    await harness.navigateByUrl('/super-admin/applications');
    expect(harness.routeNativeElement?.textContent).toContain('Loading applications');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Dr. Maya Perera');
    });

    await harness.navigateByUrl('/super-admin/applications/APP-104');
    const detail = harness.routeNativeElement!;
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(detail.textContent).toContain('Manual SLMC comparison');
    });

    const form = detail.querySelector('form')!;
    const decision = form.querySelector('select')!;
    const reason = form.querySelector('textarea')!;
    const submit = () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      harness.detectChanges();
    };

    decision.value = 'Approved';
    decision.dispatchEvent(new Event('change'));
    reason.value = '   ';
    reason.dispatchEvent(new Event('input'));
    submit();
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(detail.textContent).toContain('No decisions recorded yet.');

    reason.value = '  Compared the submitted SLMC number.\nReviewed identity evidence.  ';
    reason.dispatchEvent(new Event('input'));
    submit();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(detail.textContent).toContain('Decision recorded.');
    });

    await harness.navigateByUrl('/super-admin/applications');
    await vi.waitFor(() => {
      harness.detectChanges();
      const row = harness.routeNativeElement?.querySelector('a[href$="APP-104"]');
      expect(row?.textContent).toContain('Approved');
    });

    await harness.navigateByUrl('/super-admin/applications/APP-104');
    await vi.waitFor(() => {
      harness.detectChanges();
      const history = harness.routeNativeElement?.querySelector('.history');
      expect(history?.textContent).toContain('Demo reviewer');
      expect(history?.textContent).toContain('Compared the submitted SLMC number.');
      expect(history?.querySelector('time')?.getAttribute('datetime')).toBeTruthy();
    });
  });

  it('shows the detail error and a return link for an unknown application', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-super-admin', ['super_admin']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/super-admin/applications/missing');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Unable to open this application');
    });
    expect(harness.routeNativeElement?.querySelector('a.back')?.getAttribute('href')).toBe(
      '/super-admin/applications',
    );
  });
});
