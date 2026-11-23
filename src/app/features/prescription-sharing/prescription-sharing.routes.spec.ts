import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';
import { AuthService } from '../../core/auth.service';
import { ActiveRoleService } from '../../core/context/active-role.service';
import { OrganizationsService } from '../administration/organizations/organizations.service';

const cases = [
  { role: 'patient', title: 'Share a prescription' },
  { role: 'pharmacist', title: 'Claim a prescription' },
];
function configure(role: string | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: {
          restoreSession: vi.fn(async () => {
            await Promise.resolve();
            if (role) TestBed.inject(ActiveRoleService).setAccountRoles('routing-sample', [role]);
            return !!role;
          }),
          getOwnProfile: vi.fn(),
        },
      },
      {
        provide: OrganizationsService,
        useValue: { listPublicOrganizations: vi.fn().mockResolvedValue([]) },
      },
    ],
  });
  TestBed.inject(ActiveRoleService).clear();
}
describe('prescription sharing protected direct links', () => {
  beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
  for (const { role, title } of cases) {
    const path = '/workspace/' + role + '/prescription-shares';
    it('client renders ' + role + ' route before the SSR wildcard', () => {
      const match = serverRoutes.find((r) => r.path === path.slice(1) || r.path === '**');
      expect(match?.path).toBe(path.slice(1));
      expect(match?.renderMode).toBe(RenderMode.Client);
    });
    it(
      'restores session and loads correct audience on ' + role + ' direct navigation and refresh',
      async () => {
        configure(role);
        const first = await RouterTestingHarness.create(path);
        await first.fixture.whenStable();
        first.detectChanges();
        expect(TestBed.inject(Router).url).toBe(path);
        expect(first.routeNativeElement?.querySelector('h1')?.textContent).toBe(title);
        TestBed.resetTestingModule();
        configure(role);
        const refreshed = await RouterTestingHarness.create(path);
        await refreshed.fixture.whenStable();
        refreshed.detectChanges();
        expect(TestBed.inject(Router).url).toBe(path);
        expect(refreshed.routeNativeElement?.querySelector('h1')?.textContent).toBe(title);
      },
    );
    it('rejects signed-out ' + role + ' visitors', async () => {
      configure(null);
      await RouterTestingHarness.create(path);
      expect(TestBed.inject(Router).url).toBe('/login');
    });
    it('rejects the wrong role on ' + role + ' route', async () => {
      configure('doctor');
      const harness = await RouterTestingHarness.create(path);
      expect(TestBed.inject(Router).url).toBe('/access-denied');
      expect(harness.routeNativeElement?.querySelector('app-prescription-sharing')).toBeFalsy();
    });
  }
});
