import { Routes } from '@angular/router';

export const coursesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./courses').then((m) => m.Courses),

    children: [
      {
        path: 'coursesCategories',
        loadComponent: () => import('./courses-categories/courses-categories').then((m) => m.CoursesCategories),
        title: 'Courses | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'add',
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./courses-categories/add-courses-categories/add-courses-categories').then(
                (m) => m.AddCoursesCategories,
              ),
            title: 'Add Course Categories | ICETL',
          },
          {
            path: 'view',
            loadComponent: () =>
              import('./courses-categories/view-courses-categories/view-courses-categories').then(
                (m) => m.ViewCoursesCategories,
              ),
            title: 'View Course Categories | ICETL',
          },
        ],
      },
      {
        path: 'manageCourses',
        loadComponent: () => import('./manage-courses/manage-courses').then((m) => m.ManageCourses),
        title: 'Courses | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'add',
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./manage-courses/add-courses/add-courses').then(
                (m) => m.AddCourses,
              ),
            title: 'Add Course  | ICETL',
          },
          {
            path: 'view',
            loadComponent: () =>
              import('./manage-courses/view-courses/view-courses').then(
                (m) => m.ViewCourses,
              ),
            title: 'View Course  | ICETL',
          },
        ],
      },
    ],
  },
];
