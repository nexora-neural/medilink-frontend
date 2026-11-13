import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../auth.service';
import { ActiveRoleService } from '../context/active-role.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { restoreSession: vi.fn().mockResolvedValue(false) } },
      ],
    });
  });

  function check(allowedRoles?: string[]) {
    const route = {
      data: allowedRoles ? { allowedRoles } : {},
    } as ActivatedRouteSnapshot;

    return TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
  }

  async function expectDenied(result: unknown) {
    result = await result;
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/access-denied');
  }

  it('allows routes matching an assigned role', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-patient', ['patient']);

    await expect(check()).resolves.toBe(true);
    await expect(check(['Patient'])).resolves.toBe(true);
  });

  it('rejects routes for a different role', async () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-doctor', ['doctor']);

    await expectDenied(check(['Patient']));
    await expect(check(['Doctor'])).resolves.toBe(true);
  });

  it('denies access before account roles are loaded when no session can be restored', async () => {
    const result = await check(['Patient']);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('restores the session before checking an assigned role on direct navigation', async () => {
    const context = TestBed.inject(ActiveRoleService);
    vi.mocked(TestBed.inject(AuthService).restoreSession).mockImplementation(async () => {
      context.setAccountRoles('demo-super-admin', ['super_admin']);
      return true;
    });

    await expect(check(['Super Admin'])).resolves.toBe(true);
    expect(TestBed.inject(AuthService).restoreSession).toHaveBeenCalledOnce();
  });

  it('does not allow selecting an unassigned role', async () => {
    const context = TestBed.inject(ActiveRoleService);

    context.setAccountRoles('demo-patient', ['patient']);
    context.setActiveRole('Super Admin');

    expect(context.activeRole()).toBe('Patient');
    expect(context.roles()).toEqual(['Patient']);
    await expectDenied(check(['Super Admin']));
  });
});
