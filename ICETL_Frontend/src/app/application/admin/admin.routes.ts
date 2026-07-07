import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin').then((m) => m.Admin),

    children: [
      {
        path: '',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: '',
        loadComponent: () => import('./welcome/welcome').then((m) => m.Welcome),
        title: 'Admin | ICETL',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Admin Dashboard | ICETL',
      },
      // {
      //   path: 'payments',
      //   loadComponent: () =>
      //     import('./payment-management/payment-management').then((m) => m.PaymentManagement),
      //   title: 'Payment Management | ICETL',
      // },
    ],
  },
];
