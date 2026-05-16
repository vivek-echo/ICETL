import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NavItem {
  label: string;
  route?: string;
  exact?: boolean;
  icon?: string;
  children?: NavItem[]; // ✅ IMPORTANT
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private navItems = new BehaviorSubject<NavItem []>([]);
  navItems$ = this.navItems.asObservable();

  constructor() {
    this.loadNavigation();
  }

  loadNavigation() {
    const dashboardRaw = localStorage.getItem('dashboardsetting');
    let dashboard = null;

    try {
      dashboard = dashboardRaw ? JSON.parse(dashboardRaw) : null;
    } catch (e) {}

    const nav: NavItem [] = [
      {
        label: 'Home',
        route: '/',
        exact: true,
        icon: 'fa-solid fa-house-chimney',
      },
      {
        label: 'Courses',
        route: '/courses',
        exact: true,
        icon: 'fa-solid fa-graduation-cap',
      },
      {
        label: 'About Us',
        route: '/about',
        exact: true,
        icon: 'fa-solid fa-graduation-cap',
      },
      {
        label: 'Contact Us',
        route: '/contact',
        exact: true,
        icon: 'fa-solid fa-phone',
      },
      // {
      //   label: 'Become Instructor',
      //   route: '/become-instructor',
      //   icon: 'fa-solid fa-chalkboard-user',
      // },
    ];

    if (dashboard) {
      nav.push({
        label: dashboard.dashboardName || '',
        route: '/application/' + (dashboard.dashboardUrl || ''),
      });
    }

    this.navItems.next(nav);
  }
}
