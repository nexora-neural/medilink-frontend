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
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function check(allowedRoles?: string[]) {
    const route = { data: allowedRoles ? { allowedRoles } : {} } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
  }

  it('allows an unprotected route and a route matching the active role', () => {
    expect(check()).toBe(true);
    expect(check(['Patient'])).toBe(true);
  });

  it('redirects a different active role to the access-denied page', () => {
    TestBed.inject(ActiveRoleService).setActiveRole('Doctor');
    const result = check(['Patient']);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/access-denied');
    expect(check(['Doctor'])).toBe(true);
  });
});
