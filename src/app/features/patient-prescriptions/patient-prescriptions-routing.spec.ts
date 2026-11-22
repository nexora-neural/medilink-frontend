import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { AuthService } from '../../core/auth.service';
import { ActiveRoleService } from '../../core/context/active-role.service';
import { OrganizationsService } from '../administration/organizations/organizations.service';

const path = '/workspace/patient/prescriptions';

/** A cold application starts without in-memory roles; authentication restores them. */
function configureSession(role: string | null = 'patient') {
  const auth = {
    restoreSession: vi.fn(async () => {
      await Promise.resolve();
      if (role) TestBed.inject(ActiveRoleService).setAccountRoles('routing-test', [role]);
      return role !== null;
    }),
    getOwnProfile: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: AuthService, useValue: auth },
      {
        provide: OrganizationsService,
        useValue: { listPublicOrganizations: vi.fn().mockResolvedValue([]) },
      },
    ],
  });
  TestBed.inject(ActiveRoleService).clear();
  return auth;
}

async function expectPrescriptionPage(harness: RouterTestingHarness) {
  await harness.fixture.whenStable();
  harness.detectChanges();
  expect(TestBed.inject(Router).url).toBe(path);
  expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('My prescriptions');
  expect(harness.routeNativeElement?.textContent).toContain('Not clinically verified');
}

describe('patient prescription direct navigation and refresh', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('matches client rendering before the prerender fallback', () => {
    // Assert first-match behavior, not just the existence of a later entry.
    const match = serverRoutes.find((route) => route.path === path.slice(1) || route.path === '**');
    expect(match?.path).toBe(path.slice(1));
    expect(match?.renderMode).toBe(RenderMode.Client);
  });

  it('waits for session restoration before opening a direct Patient link', async () => {
    const auth = configureSession();
    let restore: (() => void) | undefined;
    auth.restoreSession.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          restore = () => {
            TestBed.inject(ActiveRoleService).setAccountRoles('routing-test', ['patient']);
            resolve(true);
          };
        }),
    );
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(path);
    await vi.waitFor(() => expect(auth.restoreSession).toHaveBeenCalled());
    expect(TestBed.inject(ActiveRoleService).roles()).toEqual([]);
    expect(harness.routeNativeElement?.querySelector('app-patient-prescriptions')).toBeFalsy();
    restore!();
    await navigation;
    await expectPrescriptionPage(harness);
  });

  it('restores the Patient route on a fresh application after refresh', async () => {
    const firstAuth = configureSession();
    const initial = await RouterTestingHarness.create(path);
    await expectPrescriptionPage(initial);
    expect(firstAuth.restoreSession).toHaveBeenCalled();
    const originalRouter = TestBed.inject(Router);

    // A refresh creates a new application, router, role context and preview store.
    // No role or component state from the first application is reused.
    TestBed.resetTestingModule();
    const restoredAuth = configureSession();
    expect(TestBed.inject(Router)).not.toBe(originalRouter);
    expect(TestBed.inject(ActiveRoleService).roles()).toEqual([]);
    const refreshed = await RouterTestingHarness.create(path);
    await expectPrescriptionPage(refreshed);
    expect(restoredAuth.restoreSession).toHaveBeenCalled();
    expect(refreshed.routeNativeElement?.textContent).toContain('No patient-added prescriptions');
  });

  it('keeps a signed-out direct visitor behind the login guard', async () => {
    configureSession(null);
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('app-patient-prescriptions')).toBeFalsy();
  });

  it('denies direct access when the restored account is a Doctor', async () => {
    configureSession('doctor');
    const harness = await RouterTestingHarness.create(path);
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Access denied');
  });
});
