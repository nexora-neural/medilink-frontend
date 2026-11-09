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
    await harness.navigateByUrl('/workspace/patient/medications');
    expect(harness.routeNativeElement?.textContent).toContain('Medications');

    TestBed.inject(ActiveRoleService).setActiveRole('Doctor');
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
    TestBed.inject(ActiveRoleService).setActiveRole('Super Admin');
    await harness.navigateByUrl('/super-admin/organizations');
    expect(harness.routeNativeElement?.textContent).toContain('Organizations and memberships');
  });
});
