import { Routes } from '@angular/router';
import { Application } from './application';
import { ROLE } from '../commonServices/constants.service';
import { roleGuard } from '../commonServices/role.guard';

export const applicationRoutes: Routes = [
  {
    path: '',
    component: Application,
    canActivateChild: [roleGuard],

    children: [
      {
        path: 'instructor',
        canActivate: [roleGuard],
        data: { roles: [ROLE.INSTRUCTOR, 'instructor'] },

        loadChildren: () =>
          import('./instructor/instructor.routes').then(
            (m) => m.instructorRoutes
          ),

        title: 'Instructor | ICETL',
      },
      {
        path: 'learner',
        canActivate: [roleGuard],
        data: { roles: [ROLE.STUDENT, 'learner'] },
        loadChildren: () =>
          import('./learner/learner.routes').then(
            (m) => m.learnerRoutes
          ),

        title: 'Learner | ICETL',
      },
      {
        path: 'admin',
        // canActivate: [roleGuard],
        data: { roles: [ROLE.ADMIN, 'admin'] },
        loadChildren: () =>
          import('./admin/admin.routes').then(
            (m) => m.adminRoutes
          ),

        title: 'Learner | ICETL',
      },
      {
        path: 'icetl-team',
        canActivate: [roleGuard],
        data: { roles: [ROLE.ICETL_TEAM, 'icetl-team', 'icetl team', 'team'] },
        loadChildren: () =>
          import('./icetl-team/icetl-team.routes').then(
            (m) => m.icetlTeamRoutes
          ),

        title: 'ICETL Team | ICETL',
      },
      {
        path: 'enquiries',
        canActivate: [roleGuard],
        data: { roles: [ROLE.ADMIN, ROLE.ICETL_TEAM], allowWithoutMenu: true },
        loadComponent: () => import('./enquiries/enquiries').then((m) => m.EnquiriesComponent),
        title: 'Enquiries | ICETL',
      },
      {
        path: 'courses',
        loadChildren: () =>
          import('./courses/courses.routes').then(
            (m) => m.coursesRoutes
          ),

        title: 'Learner | ICETL',
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
        data: { authOnly: true },
        loadComponent: () =>
          import('./payment-management/payment-management').then((m) => m.PaymentManagement),
        title: 'Payment Management | ICETL',
      },
      {
        path: 'myLearning',
        data: { authOnly: true },
        pathMatch: 'full',
        redirectTo: '/application/courses/myLearning',
        title: 'My Learning | ICETL',
      },
    ],
  },
];
