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
        path: 'about',
        loadComponent: () => import('./pages/about/about').then((m) => m.AboutComponent),
        title: 'About Us | ICETL',
      },
      {
        path: 'contact',
        loadComponent: () => import('./pages/contact/contact').then((m) => m.ContactComponent),
        title: 'Contact Us | ICETL',
      },
      {
        path: 'faq',
        loadComponent: () => import('./pages/faq/faq').then((m) => m.FaqComponent),
        title: 'FAQ | ICTEL',
      },
      {
        path: 'courses',
        loadComponent: () => import('./pages/courses/courses').then((m) => m.CoursesComponent),
        title: 'Courses | ICETL',
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
