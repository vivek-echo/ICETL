import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { ROLE } from './constants.service';

interface StoredUser {
  role?: number | string | null;
  menus?: unknown;
  dashboard?: {
    dashboardName?: string | null;
    dashboardUrl?: string | null;
  } | null;
}

interface StoredMenu {
  url?: string | null;
  deletedFlag?: number;
}

type AllowedRole = number | string;

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

  const user = authService.getUser() as StoredUser;

  if (isAuthOnlyRoute(route, state.url)) {
    return true;
  }

  const allowedRoles = getAllowedRoles(route);

  if (allowedRoles.length > 0 && !hasAllowedRole(user, allowedRoles)) {
    return getDashboardUrlTree(router, user);
  }

  if (route.data['allowWithoutMenu'] === true && allowedRoles.length > 0) {
    return true;
  }

  if (isMenuRouteAllowed(user, state.url)) {
    return true;
  }

  return getDashboardUrlTree(router, user);
};

function getAllowedRoles(route: ActivatedRouteSnapshot): AllowedRole[] {
  const roles = route.data['roles'] ?? route.data['allowedRoles'];

  return Array.isArray(roles) ? roles : [];
}

function isAuthOnlyRoute(route: ActivatedRouteSnapshot, url: string): boolean {
  const currentRoute = normalizeRoute(url).toLowerCase();

  return (
    route.data['authOnly'] === true ||
    currentRoute === '/application/cart' ||
    currentRoute === '/application/yourcart'
  );
}

function hasAllowedRole(user: StoredUser, allowedRoles: AllowedRole[]): boolean {
  const userRoleId = Number(user.role);
  const userRoleValues = new Set([
    Number.isNaN(userRoleId) ? '' : `${userRoleId}`,
    normalizeRoleValue(user.role),
    normalizeRoleValue(user.dashboard?.dashboardName),
    normalizeRoleValue(user.dashboard?.dashboardUrl),
  ]);

  return allowedRoles.some((role) => {
    const roleId = Number(role);
    const roleValues = [
      Number.isNaN(roleId) ? '' : `${roleId}`,
      normalizeRoleValue(role),
    ];

    return roleValues.some((roleValue) => roleValue.length > 0 && userRoleValues.has(roleValue));
  });
}

function isMenuRouteAllowed(user: StoredUser, url: string): boolean {
  const currentRoute = normalizeRoute(url);
  const dashboardRoute = getDashboardRoute(user);

  if (!currentRoute.startsWith('/application')) {
    return true;
  }

  if (dashboardRoute && currentRoute === dashboardRoute) {
    return true;
  }

  const menuRoutes = getStoredMenuRoutes(user);

  return menuRoutes.has(currentRoute);
}

function getStoredMenuRoutes(user: StoredUser): Set<string> {
  const storedMenus = readMenusFromLocalStorage();
  const menus = storedMenus.length ? storedMenus : normalizeMenus(user.menus);
  const dashboardSegment = getDashboardRouteSegment(user.dashboard?.dashboardUrl);

  return new Set(
    menus
      .filter((menu) => menu.deletedFlag !== 1)
      .map((menu) => resolveMenuRoute(menu.url, dashboardSegment))
      .filter((route): route is string => Boolean(route)),
  );
}

function readMenusFromLocalStorage(): StoredMenu[] {
  try {
    return normalizeMenus(JSON.parse(localStorage.getItem('menus') || '[]'));
  } catch {
    return [];
  }
}

function normalizeMenus(value: unknown): StoredMenu[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is StoredMenu => {
    const menu = item as StoredMenu;

    return typeof menu.url === 'string' && menu.url.trim().length > 0;
  });
}

function resolveMenuRoute(url: string | null | undefined, dashboardSegment: string): string | null {
  const route = `${url ?? ''}`.trim();

  if (!route) {
    return null;
  }

  if (route.startsWith('/')) {
    return normalizeRoute(route);
  }

  if (route.startsWith('application/')) {
    return normalizeRoute(`/${route}`);
  }

  const applicationRootSegments = new Set([
    'admin',
    'courses',
    'icetl-team',
    'instructor',
    'learner',
    'workshopSeminar',
    'workshop-seminar',
  ]);
  const rootSegment = route.split('/')[0];

  if (applicationRootSegments.has(rootSegment)) {
    return normalizeRoute(`/application/${route}`);
  }

  if (!dashboardSegment || route === dashboardSegment || route.startsWith(`${dashboardSegment}/`)) {
    return normalizeRoute(`/application/${route}`);
  }

  return normalizeRoute(`/application/${dashboardSegment}/${route}`);
}

function getDashboardUrlTree(router: Router, user: StoredUser) {
  const dashboardSegment = getDashboardRouteSegment(user.dashboard?.dashboardUrl) || getRoleDashboard(user.role);

  return dashboardSegment
    ? router.createUrlTree(['/application', dashboardSegment])
    : router.createUrlTree(['/login']);
}

function getDashboardRoute(user: StoredUser): string {
  const dashboardSegment = getDashboardRouteSegment(user.dashboard?.dashboardUrl) || getRoleDashboard(user.role);

  return dashboardSegment ? `/application/${dashboardSegment}` : '';
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

function normalizeRoleValue(value: unknown): string {
  return `${value ?? ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getDashboardRouteSegment(value: unknown): string {
  return `${value ?? ''}`.trim().replace(/^\/+|\/+$/g, '');
}

function normalizeRoute(value: string): string {
  const [path] = value.split(/[?#]/);
  const normalizedPath = path
    .trim()
    .replace(/\/+$/g, '');

  return normalizedPath || '/';
}
