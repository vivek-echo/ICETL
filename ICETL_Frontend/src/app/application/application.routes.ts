import { Routes } from '@angular/router';
import { Application } from './application';
import { roleGuard } from '../commonServices/role.guard';

export const applicationRoutes: Routes = [
  {
    path: '',
    component: Application,
    canActivateChild: [roleGuard],

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        data: { authOnly: true },
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.DynamicDashboard),
        title: 'Dashboard | ICETL',
      },
      {
        path: 'profile/instructor',
        pathMatch: 'full',
        redirectTo: '/application/profile',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.Profile),
        title: 'Instructor Profile | ICETL',
      },
      {
        path: 'enquiries',
        loadComponent: () => import('./enquiries/enquiries').then((m) => m.EnquiriesComponent),
        title: 'Enquiries | ICETL',
      },
      {
        path: 'courses',
        loadChildren: () =>
          import('./courses/courses.routes').then(
            (m) => m.coursesRoutes
          ),

        title: 'Courses | ICETL',
      },
      {
        path: 'workshopSeminar',
        loadChildren: () =>
          import('./workshop-seminar/workshop-seminar.routes').then(
            (m) => m.workshopSeminarRoutes
          ),
        title: 'Workshop & Seminar | ICETL',
      },
      {
        path: 'workshop-seminar',
        loadChildren: () =>
          import('./workshop-seminar/workshop-seminar.routes').then(
            (m) => m.workshopSeminarRoutes
        ),
        title: 'Workshop & Seminar | ICETL',
      },
      {
        path: 'administration',
        loadChildren: () =>
          import('./manage-administration/manage-administration.routes').then(
            (m) => m.manageAdministrationRoutes
          ),
        title: 'Manage Administration | ICETL',
      },
      {
        path: 'adminstration',
        loadChildren: () =>
          import('./manage-administration/manage-administration.routes').then(
            (m) => m.manageAdministrationRoutes
          ),
        title: 'Manage Administration | ICETL',
      },
      {
        path: 'yourCart',
        data: { authOnly: true },
        loadComponent: () => import('./your-cart/your-cart').then((m) => m.YourCart),
        title: 'Your Cart | ICETL',
      },
      {
        path: 'cart',
        data: { authOnly: true },
        loadComponent: () => import('./your-cart/your-cart').then((m) => m.YourCart),
        title: 'Your Cart | ICETL',
      },
      {
        path: 'paymentLog',
        data: { authOnly: true },
        loadComponent: () =>
          import('./payment-log/payment-log').then((m) => m.PaymentLogComponent),
        title: 'Payment Log | ICETL',
      },
      {
        path: 'payment',
        loadComponent: () =>
          import('./payment-management/payment-management').then((m) => m.PaymentManagement),
        title: 'Payment Management | ICETL',
      },
      {
        path: 'myLearning',
        pathMatch: 'full',
        redirectTo: '/application/courses/myLearning',
        title: 'My Learning | ICETL',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
