import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../commonServices/auth.service';
import { getApplicationDashboardUrlTreeCommands } from '../../commonServices/auth-navigation';

export const loginRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId) || !authService.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(getApplicationDashboardUrlTreeCommands());
};
