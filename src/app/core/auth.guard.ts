import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** The server renders only the shell; the browser validates the active session. */
export const authGuard: CanActivateFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return (await auth.restoreSession()) || router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};
