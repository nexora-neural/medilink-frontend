import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { ActiveRoleService } from '../context/active-role.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  function check(allowedRoles?: string[]) {
    const route = {
      data: allowedRoles ? { allowedRoles } : {},
    } as ActivatedRouteSnapshot;

    return TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
  }

  function expectDenied(result: unknown) {
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/access-denied');
  }

  it('allows routes matching an assigned role', () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-patient', ['patient']);

    expect(check()).toBe(true);
    expect(check(['Patient'])).toBe(true);
  });

  it('rejects routes for a different role', () => {
    TestBed.inject(ActiveRoleService).setAccountRoles('demo-doctor', ['doctor']);

    expectDenied(check(['Patient']));
    expect(check(['Doctor'])).toBe(true);
  });

  it('denies access before account roles are loaded', () => {
    expectDenied(check(['Patient']));
    expectDenied(check());
  });

  it('does not allow selecting an unassigned role', () => {
    const context = TestBed.inject(ActiveRoleService);

    context.setAccountRoles('demo-patient', ['patient']);
    context.setActiveRole('Super Admin');

    expect(context.activeRole()).toBe('Patient');
    expect(context.roles()).toEqual(['Patient']);
    expectDenied(check(['Super Admin']));
  });
});
