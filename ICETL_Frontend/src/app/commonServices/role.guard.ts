import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import {
  StoredUser,
  canAccessApplicationRoute,
  getApplicationDashboardRoute,
  getApplicationDashboardUrlTreeCommands,
  normalizeRoute,
} from './auth-navigation';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId) || !authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const user = authService.getUser() as StoredUser | null;

  if (isAuthOnlyRoute(route, state.url)) {
    return true;
  }

  if (canAccessApplicationRoute(user, state.url)) {
    return true;
  }

  return getDashboardUrlTree(router, user);
};

function isAuthOnlyRoute(route: ActivatedRouteSnapshot, url: string): boolean {
  const currentRoute = normalizeRoute(url).toLowerCase();

  return route.data['authOnly'] === true && currentRoute === getApplicationDashboardRoute();
}

function getDashboardUrlTree(router: Router, user: StoredUser | null) {
  return user ? router.createUrlTree(getApplicationDashboardUrlTreeCommands()) : router.createUrlTree(['/login']);
}
