import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface StoredMenu {
  id: number;
  name: string;
  url?: string | null;
  parentId?: number | null;
  deletedFlag?: number;
  visiblity?: number;
}

interface OfflineCourseTab {
  id: number;
  label: string;
  route: string;
}

@Component({
  selector: 'app-manage-offline-course',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './manage-offline-course.html',
  styleUrl: './manage-offline-course.scss',
})
export class ManageOfflineCourse implements OnInit, OnDestroy {
  private readonly parentRoute = '/application/courses/manageOfflineCourses';
  private readonly fallbackTabs: OfflineCourseTab[] = [
    { id: -1, label: 'Add Offline Course', route: 'add' },
    { id: -2, label: 'View My Offline Courses', route: 'viewMyOfflineCourses' },
    { id: -3, label: 'View All Offline Courses', route: 'viewAllOfflineCourses' },
  ];
  private readonly isBrowser: boolean;
  private readonly refreshTabs = () => {
    this.loadTabs();
  };

  tabs: OfflineCourseTab[] = this.fallbackTabs;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadTabs();

    if (!this.isBrowser) {
      return;
    }

    window.addEventListener('storage', this.refreshTabs);
    window.addEventListener('auth-user-updated', this.refreshTabs);
    window.addEventListener('auth-session-cleared', this.refreshTabs);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) {
      return;
    }

    window.removeEventListener('storage', this.refreshTabs);
    window.removeEventListener('auth-user-updated', this.refreshTabs);
    window.removeEventListener('auth-session-cleared', this.refreshTabs);
  }

  private loadTabs(): void {
    if (!this.isBrowser) {
      this.tabs = this.fallbackTabs;
      return;
    }

    const menus = this.readMenus();
    const parentMenu = menus.find((menu) => this.normalizeRoute(menu.url) === this.parentRoute);
    const parentId = parentMenu?.id ?? null;

    if (!parentId) {
      this.tabs = this.fallbackTabs;
      return;
    }

    const permittedTabs = menus
      .filter((menu) => menu.deletedFlag !== 1 && menu.parentId === parentId && menu.visiblity === 1)
      .map((menu) => this.toOfflineCourseTab(menu))
      .filter((tab): tab is OfflineCourseTab => tab !== null);

    const visibleTabs = permittedTabs.length ? permittedTabs : this.fallbackTabs;
    const visibleRoutes = new Set(visibleTabs.map((tab) => tab.route));
    const missingDefaultTabs = this.fallbackTabs.filter((tab) => !visibleRoutes.has(tab.route));

    this.tabs = [...visibleTabs, ...missingDefaultTabs];
  }

  private readMenus(): StoredMenu[] {
    const storedMenus = this.normalizeMenus(this.readJson<unknown>('menus'));

    if (storedMenus.length) {
      return storedMenus;
    }

    const user = this.readJson<{ menus?: unknown }>('auth_user');
    return this.normalizeMenus(user?.menus);
  }

  private readJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);

      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private normalizeMenus(value: unknown): StoredMenu[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is StoredMenu => {
      const menu = item as Partial<StoredMenu>;

      return (
        typeof menu.id === 'number' && typeof menu.name === 'string' && menu.name.trim().length > 0
      );
    });
  }

  private toOfflineCourseTab(menu: StoredMenu): OfflineCourseTab | null {
    const route = this.normalizeRoute(menu.url);

    if (!route.startsWith(`${this.parentRoute}/`)) {
      return null;
    }

    return {
      id: menu.id,
      label: menu.name,
      route: route.replace(`${this.parentRoute}/`, ''),
    };
  }

  private normalizeRoute(url?: string | null): string {
    const route = url?.trim();

    if (!route) {
      return '';
    }

    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

    return normalizedRoute.replace(
      /\/application\/courses\/manageOfflineCourse(\/|$)/,
      '/application/courses/manageOfflineCourses$1',
    );
  }
}
