import { Routes } from '@angular/router';
import { WebsiteComponent } from './website';
import { becomeInstructorGuard } from './guards/become-instructor.guard';

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
        path: 'become-instructor',
        loadComponent: () => import('./pages/become-instructor/become-instructor').then((m) => m.BecomeInstructor),
        canActivate: [becomeInstructorGuard],
        title: 'Become an Instructor | ICETL',
      },
      {
        path: 'becomeInstructor',
        redirectTo: 'become-instructor',
        pathMatch: 'full',
      },
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then((m) => m.Login),
        title: 'Login | ICETL',
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
