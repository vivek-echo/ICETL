import { Routes } from '@angular/router';

export const learnerRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./learner').then((m) => m.Learner),

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
      }
    ],
  },
];
