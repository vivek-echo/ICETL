import { Routes } from '@angular/router';
import { curriculumPendingChangesGuard } from './manage-courses/add-course-curriculum/curriculum-pending-changes.guard';

const normalizeCourseRoute = (route: string): string =>
  route.replace(
    /\/application\/courses\/manageOfflineCourse(\/|$)/,
    '/application/courses/manageOfflineCourses$1',
  );

const getRedirectRoute = (route: string, fallbackRoute = ''): string => {
  if (typeof localStorage === 'undefined') {
    return fallbackRoute;
  }

  const getMenus = localStorage.getItem('menus');

  if (!getMenus) return fallbackRoute;

  try {
    const menus = JSON.parse(getMenus);

    if (!Array.isArray(menus)) {
      return fallbackRoute;
    }

    const matchedMenu = menus.find((menu: any) => {
      const menuUrl = normalizeCourseRoute(menu.url || '');
      return menuUrl === normalizeCourseRoute(route);
    });

    if (!matchedMenu) {
      return fallbackRoute;
    }

    const getTab = (menuId: number | null) => {
      if (!menuId) return null;
      return menus.find((menu: any) => menu.parentId === menuId);
    };

    const tab = getTab(matchedMenu.id);
    if (tab) {
      return tab.url.split('/').pop() || '';
    }
    return fallbackRoute;
  } catch (error) {
    console.error('Error parsing menus:', error);
    return fallbackRoute;
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
            path: 'browseAcademicCourses',
            loadComponent: () =>
              import('./manage-courses/browse-academic-courses/browse-academic-courses').then(
                (m) => m.BrowseAcademicCourses,
              ),
            title: 'Browse Academic Courses | ICETL',
          },
          {
            path: 'browseWorkshop',
            data: { programType: 'workshop', authOnly: true },
            loadComponent: () =>
              import('./manage-courses/program-browse/program-browse').then(
                (m) => m.ProgramBrowseComponent,
              ),
            title: 'Browse Workshop | ICETL',
          },
          {
            path: 'browseSeminars',
            data: { programType: 'seminar', authOnly: true },
            loadComponent: () =>
              import('./manage-courses/program-browse/program-browse').then(
                (m) => m.ProgramBrowseComponent,
              ),
            title: 'Browse Seminars | ICETL',
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
            redirectTo: '/application/courses/myLearning',
            pathMatch: 'full',
          },
        ],
      },

      {
        path: 'myLearning',
        data: { authOnly: true },
        loadComponent: () => import('./my-learning/my-learning').then((m) => m.MyLearning),
        title: 'My Learning | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: getRedirectRoute('/application/courses/myLearning'),
          },
         
          {
            path: 'learn',
            loadComponent: () =>
              import('./my-learning/course-player/course-player').then((m) => m.CoursePlayer),
            title: 'Course Player | ICETL',
          },
          {
            path: 'myCourses',
            loadComponent: () =>
              import('./my-learning/my-courses/my-courses').then((m) => m.MyCourses),
            title: 'My Learning | ICETL',
          },
          {
            path: 'myWorkshops',
            loadComponent: () =>
              import('./my-learning/my-workshop/my-workshop').then((m) => m.MyWorkshop),
            title: 'My Learning | ICETL',
          },
          {
            path: 'mySeminars',
            loadComponent: () =>
              import('./my-learning/my-seminar/my-seminar').then((m) => m.MySeminar),
            title: 'My Learning | ICETL',
          },
        ],
      },
      {
        path: 'manageOfflineCourse',
        redirectTo: 'manageOfflineCourses',
        pathMatch: 'prefix',
      },
      {
        path: 'manageOfflineCourses',
        loadComponent: () =>
          import('./manage-offline-course/manage-offline-course').then(
            (m) => m.ManageOfflineCourse,
          ),
        title: 'Offline Courses | ICETL',
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: getRedirectRoute('/application/courses/manageOfflineCourses', 'add'),
          },
          {
            path: 'view',
            redirectTo: 'viewMyOfflineCourses',
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./manage-offline-course/add-offline-course/add-offline-course').then(
                (m) => m.AddOfflineCourse,
              ),
            title: 'Add Offline Course | ICETL',
          },
          {
            path: 'viewMyOfflineCourses',
            loadComponent: () =>
              import(
                './manage-offline-course/view-my-offline-course/view-my-offline-course'
              ).then((m) => m.ViewMyOfflineCourse),
            data: { offlineCourseScope: 'mine' },
            title: 'View My Offline Courses | ICETL',
          },
          {
            path: 'viewAllOfflineCourses',
            loadComponent: () =>
              import(
                './manage-offline-course/view-all-offline-course/view-all-offline-course'
              ).then((m) => m.ViewAllOfflineCourse),
            data: { offlineCourseScope: 'all' },
            title: 'View All Offline Courses | ICETL',
          },
          {
            path: 'enrolledStudents',
            loadComponent: () =>
              import(
                './manage-offline-course/offline-course-students/offline-course-students'
              ).then((m) => m.OfflineCourseStudents),
            data: { offlineCourseScope: 'all' },
            title: 'Enrolled Students | ICETL',
          },
        ],
      },
    ],
  },
];
