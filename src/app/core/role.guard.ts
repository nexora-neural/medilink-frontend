import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ActiveRole, ActiveRoleService } from './active-role.service';
export const roleGuard: CanActivateFn = (route) => {
  const activeRole = inject(ActiveRoleService).activeRole();
  const allowedRoles = route.data['allowedRoles'] as ActiveRole[] | undefined;
  if (!allowedRoles || allowedRoles.includes(activeRole)) return true;
  return inject(Router).createUrlTree(['/access-denied']);
};
