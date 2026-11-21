import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { AuthService } from '../../../../core/auth.service';
import { ActiveRoleService } from '../../../../core/context/active-role.service';

const path = '/workspace/doctor/prescriptions/sample-order/issue';
describe('ML-117 protected navigation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: { restoreSession: vi.fn().mockResolvedValue(true) } },
      ],
    });
  });
  it('opens the review for an authenticated Doctor and renders on the client', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('doctor', ['doctor']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Review & issue prescription');
    });
    expect(TestBed.inject(Router).url).toBe(path);
    expect(
      serverRoutes.find((r) => r.path === 'workspace/doctor/prescriptions/:id/issue')?.renderMode,
    ).toBe(RenderMode.Client);
  });
  it('rejects a Patient', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('patient', ['patient']);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/access-denied');
  });
  it('requires authentication', async () => {
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
