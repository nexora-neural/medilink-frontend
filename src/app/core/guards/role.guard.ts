import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ActiveRole, ActiveRoleService } from '../context/active-role.service';

export const roleGuard: CanActivateFn = async (route) => {
  const context = inject(ActiveRoleService);
  const router = inject(Router);
  const auth = inject(AuthService);

  if (context.roles().length === 0) {
    try {
      if (!(await auth.restoreSession())) {
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

  if (route.data['allowPendingProfessionalApplicant'] && context.roles().length === 0) {
    try {
      const profile = (await auth.getOwnProfile()).professional_profile;
      if (!profile || !['doctor', 'pharmacist', 'lab_staff'].includes(profile.role)) {
        return router.createUrlTree(['/access-denied']);
      }
      switch (profile.verification_status) {
        case 'not_submitted':
        case 'pending':
        case 'rejected':
        case 'more_info_requested':
          return true;
      }
    } catch {
      // Fall through to access denied when the applicant profile cannot be loaded.
    }
  }

  return router.createUrlTree(['/access-denied']);
};
