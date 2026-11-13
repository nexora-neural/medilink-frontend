import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ActiveRole, ActiveRoleService } from '../context/active-role.service';

export const roleGuard: CanActivateFn = async (route) => {
  const context = inject(ActiveRoleService);
  const router = inject(Router);

  if (context.roles().length === 0) {
    try {
      if (!(await inject(AuthService).restoreSession())) {
        return router.createUrlTree(['/login']);
      }
    } catch {
      return router.createUrlTree(['/login']);
    }
  }

  const allowedRoles = route.data['allowedRoles'] as ActiveRole[] | undefined;

  const activeRole = context.activeRole();
  const hasRole = context.roles().includes(activeRole);

  if (hasRole && (!allowedRoles || allowedRoles.includes(activeRole))) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
