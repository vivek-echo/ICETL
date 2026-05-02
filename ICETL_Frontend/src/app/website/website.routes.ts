import { Routes } from '@angular/router';
import { WebsiteComponent } from './website';

export const websiteRoutes: Routes = [
  {
    path: '',
    component: WebsiteComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
        title: 'Home | ICETL',
      },
      {
        path: 'courses',
        loadComponent: () => import('./pages/courses/courses').then((m) => m.CoursesComponent),
        title: 'Courses | ICETL',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((m) => m.DashboardComponent),
        title: 'Dashboard | ICETL',
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
