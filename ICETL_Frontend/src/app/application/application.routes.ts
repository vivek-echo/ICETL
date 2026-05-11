import { Routes } from '@angular/router';
import { Application } from './application';

export const applicationRoutes: Routes = [
  {
    path: '',
    component: Application,

    children: [
      {
        path: 'instructor',

        loadChildren: () =>
          import('./instructor/instructor.routes').then(
            (m) => m.instructorRoutes
          ),

        title: 'Instructor | ICETL',
      },
      {
        path: 'learner',
        loadChildren: () =>
          import('./learner/learner.routes').then(
            (m) => m.learnerRoutes
          ),

        title: 'Learner | ICETL',
      },
      {
        path: 'admin',
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
    ],
  },
];