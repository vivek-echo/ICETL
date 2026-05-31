import { Routes } from '@angular/router';

export const icetlTeamRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./icetl-team').then((m) => m.IcetlTeam),

    children: [
      {
        path: '',
        loadComponent: () => import('./welcome/welcome').then((m) => m.Welcome),
        title: 'ICETL Team | ICETL',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: 'ICETL Team Dashboard | ICETL',
      },
    ],
  },
];
