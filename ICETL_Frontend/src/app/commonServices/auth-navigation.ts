import { StoredMenu, isStoredMenuVisible, normalizeStoredMenus } from './menu-utils';

export const APPLICATION_DASHBOARD_ROUTE = '/application/dashboard';

export interface StoredDashboard {
  dashboardName?: string | null;
  dashboardUrl?: string | null;
}

export interface StoredUser {
  role?: number | string | null;
  menus?: unknown;
  dashboard?: StoredDashboard | null;
}

export function readJsonFromStorage<T>(key: string): T | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getStoredDashboard(): StoredDashboard | null {
  return readJsonFromStorage<StoredDashboard>('dashboardsetting');
}

export function getStoredMenusForUser(user?: StoredUser | null): StoredMenu[] {
  const storedMenus = normalizeStoredMenus(readJsonFromStorage<unknown>('menus'));

  return storedMenus.length ? storedMenus : normalizeStoredMenus(user?.menus);
}

export function getApplicationDashboardRoute(): string {
  return APPLICATION_DASHBOARD_ROUTE;
}

export function getApplicationDashboardUrlTreeCommands(): string[] {
  return ['/application', 'dashboard'];
}

export function canAccessApplicationRoute(
  user: StoredUser | null | undefined,
  url: string,
  allowDashboard = true,
): boolean {
  const currentRoute = normalizeRoute(url);

  if (!currentRoute.startsWith('/application')) {
    return true;
  }

  if (allowDashboard && isDashboardRoute(currentRoute)) {
    return true;
  }

  const menuRoutes = getStoredMenuRoutes(user);

  return Array.from(menuRoutes).some((route) => route === currentRoute || isDescendantRoute(currentRoute, route));
}

export function getStoredMenuRoutes(user: StoredUser | null | undefined): Set<string> {
  return new Set(
    getStoredMenusForUser(user)
      .filter((menu) => menu.deletedFlag !== 1 && isStoredMenuVisible(menu))
      .map((menu) => resolveApplicationRoute(menu.url))
      .filter((route): route is string => Boolean(route)),
  );
}

export function resolveApplicationRoute(url: string | null | undefined): string | null {
  const rawRoute = `${url ?? ''}`.trim();

  if (!rawRoute) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawRoute)) {
    return rawRoute;
  }

  let route = decodeRoute(rawRoute).replace(/\\/g, '/').replace(/\/+$/g, '');

  if (isDashboardRoute(route)) {
    return APPLICATION_DASHBOARD_ROUTE;
  }

  if (route.startsWith('/')) {
    return normalizeRoute(route);
  }

  if (route.startsWith('application/')) {
    return normalizeRoute(`/${route}`);
  }

  return normalizeRoute(`/application/${route}`);
}

export function isDashboardRoute(url: string): boolean {
  const route = normalizeRoute(url);

  if (route === APPLICATION_DASHBOARD_ROUTE) {
    return true;
  }

  return stripApplicationPrefix(route) === 'dashboard';
}

export function normalizeRoute(value: string): string {
  const [path] = value.split(/[?#]/);
  const normalizedPath = decodeRoute(path)
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/g, '');

  return normalizeKnownApplicationRoute(normalizedPath || '/');
}

function normalizeKnownApplicationRoute(route: string): string {
  return route
    .replace(/\/application\/workshop-seminar(\/|$)/, '/application/workshopSeminar$1')
    .replace(/\/application\/courses\/manageOfflineCourse(\/|$)/, '/application/courses/manageOfflineCourses$1')
    .replace(/\/application\/adminstration(\/|$)/, '/application/administration$1');
}

function isDescendantRoute(currentRoute: string, menuRoute: string): boolean {
  return (
    menuRoute !== APPLICATION_DASHBOARD_ROUTE &&
    menuRoute.startsWith('/application/') &&
    currentRoute.startsWith(`${menuRoute}/`)
  );
}

function stripApplicationPrefix(route: string): string {
  return route.replace(/^\/?application\/?/, '').replace(/^\/+|\/+$/g, '');
}

function decodeRoute(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
