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
        canActivate: [roleGuard],
        data: { roles: [ROLE.ADMIN, 'admin'] },
        loadChildren: () =>
          import('./admin/admin.routes').then(
            (m) => m.adminRoutes
          ),

        title: 'Learner | ICETL',
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
        path: 'yourCart',
        data: { authOnly: true },
        loadComponent: () => import('./courses/your-cart/your-cart').then((m) => m.YourCart),
        title: 'Your Cart | ICETL',
      },
      {
        path: 'cart',
        data: { authOnly: true },
        loadComponent: () => import('./courses/your-cart/your-cart').then((m) => m.YourCart),
        title: 'Your Cart | ICETL',
      },
      {
        path: 'paymentLog',
        data: { authOnly: true },
        loadComponent: () =>
          import('./courses/payment-log/payment-log').then((m) => m.PaymentLogComponent),
        title: 'Payment Log | ICETL',
      },
      {
        path: 'myLearning',
        data: { authOnly: true },
        pathMatch: 'full',
        redirectTo: '/application/courses/manageCourses/myLearning',
        title: 'My Learning | ICETL',
      },
    ],
  },
];
