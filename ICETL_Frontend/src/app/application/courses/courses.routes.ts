import { Routes } from '@angular/router';
import { curriculumPendingChangesGuard } from './manage-courses/add-course-curriculum/curriculum-pending-changes.guard';

const getRedirectRoute = (route: string): string => {
  const getMenus = localStorage.getItem('menus');

  if (!getMenus) return '';

  try {
    const menus = JSON.parse(getMenus);

    const matchedMenu = menus.find((menu: any) => {
      const menuUrl = menu.url || '';
      return menuUrl === route;
    });

    const getTab = (menuId: number | null) => {
      if (!menuId) return null;
      return menus.find((menu: any) => menu.parentId === menuId);
    };

    const tab = getTab(matchedMenu.id);
    if (tab) {
      return tab.url.split('/').pop() || '';
    }
    return '';
  } catch (error) {
    console.error('Error parsing menus:', error);
    return '';
  }
};

export const coursesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./courses').then((m) => m.Courses),

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'manageCourses/browse',
      },
      {
        path: 'yourCart',
        redirectTo: '/application/yourCart',
      },
      {
        path: 'myLearning',
        pathMatch: 'full',
        redirectTo: '/application/courses/manageCourses/myLearning',
      },
      {
        path: 'coursesCategories',
        loadComponent: () =>
          import('./courses-categories/courses-categories').then((m) => m.CoursesCategories),
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
            redirectTo: getRedirectRoute('/application/courses/manageCourses'),
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./manage-courses/add-courses/add-courses').then((m) => m.AddCourses),
            title: 'Add Course  | ICETL',
          },
          {
            path: 'view',
            loadComponent: () =>
              import('./manage-courses/view-courses/view-courses').then((m) => m.ViewCourses),
            title: 'View Course  | ICETL',
          },
          {
            path: 'viewAll',
            loadComponent: () =>
              import('./manage-courses/view-all-courses/view-all-courses').then(
                (m) => m.ViewAllCourses,
              ),
            title: 'All Courses | ICETL',
          },
          {
            path: 'browse',
            loadComponent: () =>
              import('./manage-courses/browse-courses/browse-courses').then((m) => m.BrowseCourses),
            title: 'Browse Courses | ICETL',
          },
          {
            path: 'curriculum',
            loadComponent: () =>
              import('./manage-courses/add-course-curriculum/add-course-curriculum').then((m) => m.AddCourseCurriculum),
            canDeactivate: [curriculumPendingChangesGuard],
            title: 'Curriculum | ICETL',
          },
          {
            path: 'myLearning',
            loadComponent: () =>
              import('./manage-courses/my-learning/my-learning').then((m) => m.MyLearning),
            title: 'My Learning | ICETL',
          },
        ],
      },
    ],
  },
];
