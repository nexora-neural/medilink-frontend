import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ActiveRole, ActiveRoleService } from '../context/active-role.service';

export const roleGuard: CanActivateFn = (route) => {
  const context = inject(ActiveRoleService);
  const router = inject(Router);

  const allowedRoles = route.data['allowedRoles'] as ActiveRole[] | undefined;

  const activeRole = context.activeRole();
  const hasRole = context.roles().includes(activeRole);

  if (hasRole && (!allowedRoles || allowedRoles.includes(activeRole))) {
    return true;
  }

  return router.createUrlTree(['/access-denied']);
};
