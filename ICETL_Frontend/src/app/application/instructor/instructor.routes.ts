import { Routes } from '@angular/router';

export const instructorRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./instructor').then((m) => m.Instructor),

    children: [
      {
        path: '',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: '',
        loadComponent: () => import('./welcome/welcome').then((m) => m.Welcome),
        title: 'Instructor | ICETL',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Instructor Dashboard | ICETL',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile),
        title: 'Instructor Profile | ICETL',
      },
    ],
  },
];
