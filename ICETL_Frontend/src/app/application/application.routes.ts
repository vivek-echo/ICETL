import { Routes } from '@angular/router';
import { Application } from './application';

export const applicationRoutes: Routes = [
  {
    path: '',
    component: Application,
    children: [
      {
        path: 'learnerDashboard',
        loadComponent: () =>
          import('./learner/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard | ICETL',
      },
    ],
  },
];
