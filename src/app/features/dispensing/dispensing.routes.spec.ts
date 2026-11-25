import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { RenderMode } from '@angular/ssr';
import { authGuard } from '../../core/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';

describe('dispensing route', () => {
  it('renders on the client for authenticated direct navigation and refresh', () => {
    expect(
      serverRoutes.find((route) => route.path === 'workspace/pharmacist/dispensing')?.renderMode,
    ).toBe(RenderMode.Client);
  });
  it('requires a session and pharmacist role before loading the workspace', () => {
    const workspace = routes.find((route) => route.path === 'workspace');
    const dispensing = workspace?.children?.find((route) => route.path === 'pharmacist/dispensing');
    expect(workspace?.canActivate).toContain(authGuard);
    expect(dispensing?.canActivate).toContain(roleGuard);
    expect(dispensing?.data?.['allowedRoles']).toEqual(['Pharmacist']);
    expect(dispensing?.loadComponent).toBeDefined();
  });
});

describe('dispensing navigation', () => {
  it('restores the selected screen and does not confirm cleared preview quantities', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { provideRouter, Router } = await import('@angular/router');
    const { RouterTestingHarness } = await import('@angular/router/testing');
    const { Dispensing } = await import('./dispensing');
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'dispensing', component: Dispensing }])],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/dispensing#history', Dispensing);
    await harness.fixture.whenStable();
    expect(component.page).toBe('history');
    await harness.navigateByUrl('/dispensing#confirm');
    await harness.fixture.whenStable();
    expect(component.page).toBe('dispense');
    expect(TestBed.inject(Router).url).toBe('/dispensing#dispense');
    await harness.navigateByUrl('/dispensing#history');
    expect(component.page).toBe('history');
  });
});
