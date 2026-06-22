import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../commonServices/auth.service';
import { ROLE } from '../../commonServices/constants.service';

interface StoredDashboard {
  dashboardUrl?: string | null;
}

interface StoredUser {
  role?: number | string | null;
  dashboard?: StoredDashboard | null;
}

export const loginRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId) || !authService.isLoggedIn()) {
    return true;
  }

  const user = authService.getUser() as StoredUser;
  const dashboardSegment =
    getDashboardRouteSegment(user.dashboard?.dashboardUrl) ||
    getDashboardRouteSegment(readStoredDashboard()?.dashboardUrl) ||
    getRoleDashboard(user.role);

  return dashboardSegment ? router.createUrlTree(['/application', dashboardSegment]) : true;
};

function readStoredDashboard(): StoredDashboard | null {
  try {
    return JSON.parse(localStorage.getItem('dashboardsetting') || 'null') as StoredDashboard | null;
  } catch {
    return null;
  }
}

function getRoleDashboard(role: unknown): string {
  switch (Number(role)) {
    case ROLE.ADMIN:
      return 'admin';
    case ROLE.STUDENT:
      return 'learner';
    case ROLE.INSTRUCTOR:
      return 'instructor';
    case ROLE.ICETL_TEAM:
      return 'icetl-team';
    default:
      return '';
  }
}

function getDashboardRouteSegment(value: unknown): string {
  return `${value ?? ''}`.trim().replace(/^\/+|\/+$/g, '');
}
