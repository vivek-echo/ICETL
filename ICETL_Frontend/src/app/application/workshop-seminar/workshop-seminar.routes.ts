import { Routes } from '@angular/router';

const normalizeRoute = (url: unknown): string => {
  const route = `${url ?? ''}`
    .trim()
    .replace(/\/+$/g, '')
    .replace('/application/workshop-seminar', '/application/workshopSeminar');

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

    const parentRoute = normalizeRoute(route);
    const parentMenu = menus.find((menu: any) => normalizeRoute(menu.url) === parentRoute);

    if (!parentMenu?.id) {
      return fallbackRoute;
    }

    const childMenu = menus.find(
      (menu: any) =>
        menu.parentId === parentMenu.id &&
        menu.deletedFlag !== 1 &&
        normalizeRoute(menu.url).startsWith(`${parentRoute}/`),
    );
    const childRoute = normalizeRoute(childMenu?.url);

    return childRoute.split('/').pop() || fallbackRoute;
  } catch (error) {
    console.error('Error parsing workshop seminar menus:', error);
    return fallbackRoute;
  }
};

export const workshopSeminarRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./workshop-seminar').then((m) => m.WorkshopSeminar),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: getRedirectRoute('/application/workshopSeminar', 'workshop'),
      },
      {
        path: 'workshop',
        loadComponent: () => import('./workshop/workshop').then((m) => m.Workshop),
        title: 'Workshop | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: getRedirectRoute('/application/workshopSeminar/workshop', 'add'),
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./workshop/add-workshop/add-workshop').then((m) => m.AddWorkshop),
            title: 'Add Workshop | ICETL',
          },
          {
            path: 'edit/:id',
            data: { authOnly: true },
            loadComponent: () =>
              import('./workshop/add-workshop/add-workshop').then((m) => m.AddWorkshop),
            title: 'Edit Workshop | ICETL',
          },
          {
            path: 'viewMyWorkshop',
            loadComponent: () =>
              import('./workshop/view-my-workshop/view-my-workshop').then(
                (m) => m.ViewMyWorkshop,
              ),
            title: 'View My Workshop | ICETL',
          },
          {
            path: 'viewAllWorkshop',
            data: { authOnly: true },
            loadComponent: () =>
              import('./workshop/view-all-workshop/view-all-workshop').then(
                (m) => m.ViewAllWorkshop,
              ),
            title: 'All Workshops | ICETL',
          },
        ],
      },
      {
        path: 'seminar',
        loadComponent: () => import('./seminar/seminar').then((m) => m.Seminar),
        title: 'Seminar | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: getRedirectRoute('/application/workshopSeminar/seminar', 'add'),
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./seminar/add-seminar/add-seminar').then((m) => m.AddSeminar),
            title: 'Add Seminar | ICETL',
          },
          {
            path: 'edit/:id',
            data: { authOnly: true },
            loadComponent: () =>
              import('./seminar/add-seminar/add-seminar').then((m) => m.AddSeminar),
            title: 'Edit Seminar | ICETL',
          },
          {
            path: 'viewMySeminar',
            loadComponent: () =>
              import('./seminar/view-my-seminar/view-my-seminar').then((m) => m.ViewMySeminar),
            title: 'View My Seminar | ICETL',
          },
          {
            path: 'viewAllSeminar',
            data: { authOnly: true },
            loadComponent: () =>
              import('./seminar/view-all-seminar/view-all-seminar').then(
                (m) => m.ViewAllSeminar,
              ),
            title: 'All Seminars | ICETL',
          },
        ],
      },
    ],
  },
];
