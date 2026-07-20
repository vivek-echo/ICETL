import { Routes } from '@angular/router';

const normalizeAdministrationRoute = (url: unknown): string => {
  const route = `${url ?? ''}`
    .trim()
    .replace(/\/+$/g, '')
    .replace('/application/adminstration', '/application/administration');

  if (!route) {
    return '';
  }

  return route.startsWith('/') ? route : `/${route}`;
};

const getRedirectRoute = (route: string, fallbackRoute: string): string => {
  if (typeof localStorage === 'undefined') {
    return fallbackRoute;
  }

  try {
    const menus = JSON.parse(localStorage.getItem('menus') || '[]');

    if (!Array.isArray(menus)) {
      return fallbackRoute;
    }

    const parentRoute = normalizeAdministrationRoute(route);
    const parentMenu = menus.find(
      (menu: any) => normalizeAdministrationRoute(menu.url) === parentRoute,
    );

    if (!parentMenu?.id) {
      return fallbackRoute;
    }

    const childMenu = menus.find(
      (menu: any) =>
        menu.parentId === parentMenu.id &&
        menu.deletedFlag !== 1 &&
        normalizeAdministrationRoute(menu.url).startsWith(`${parentRoute}/`),
    );
    const childRoute = normalizeAdministrationRoute(childMenu?.url);

    return childRoute.split('/').pop() || fallbackRoute;
  } catch (error) {
    console.error('Error parsing administration menus:', error);
    return fallbackRoute;
  }
};

export const manageAdministrationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./manage-administration').then((m) => m.ManageAdministration),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'manageBranch',
      },
      {
        path: 'manageBranch',
        loadComponent: () => import('./manage-branch/manage-branch').then((m) => m.ManageBranch),
        title: 'Manage Branch | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: getRedirectRoute(
              '/application/administration/manageBranch',
              'addBranch',
            ),
          },
          {
            path: 'addBranch',
            loadComponent: () =>
              import('./manage-branch/add-branch/add-branch').then((m) => m.AddBranch),
            title: 'Add Branch | ICETL',
          },
          {
            path: 'viewBranch',
            loadComponent: () =>
              import('./manage-branch/view-branch/view-branch').then((m) => m.ViewBranch),
            title: 'View Branch | ICETL',
          },
        ],
      },
    ],
  },
];
