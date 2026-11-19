import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { routes } from '../../../app.routes';
import { serverRoutes } from '../../../app.routes.server';
import { AuthService } from '../../../core/auth.service';
import { ActiveRoleService } from '../../../core/context/active-role.service';

describe('ML-107 guarded navigation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: { restoreSession: vi.fn().mockResolvedValue(true) } },
      ],
    });
  });

  for (const path of ['/super-admin/integrations', '/super-admin/integrations/submissions']) {
    it(`opens ${path} for Super Admin and renders only on the client`, async () => {
      TestBed.inject(ActiveRoleService).setAccountRoles('super-admin', ['super_admin']);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(path);
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.textContent).toContain('Sample preview.');
      });
      expect(TestBed.inject(Router).url).toBe(path);
      expect(serverRoutes.find((item) => item.path === path.slice(1))?.renderMode).toBe(
        RenderMode.Client,
      );
    });
    it(`rejects delegated Admin at ${path}`, async () => {
      TestBed.inject(ActiveRoleService).setAccountRoles('admin', ['admin']);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(path);
      expect(TestBed.inject(Router).url).toBe('/access-denied');
    });
    it(`requires authentication at ${path}`, async () => {
      vi.mocked(TestBed.inject(AuthService).restoreSession).mockResolvedValue(false);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(path);
      expect(TestBed.inject(Router).url).toBe('/login');
    });
  }
});
