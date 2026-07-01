import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StoredMenu, isStoredMenuVisible, normalizeStoredMenus } from '../../../commonServices/menu-utils';

interface SeminarTab {
  id: number;
  label: string;
  route: string;
}

@Component({
  selector: 'app-seminar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './seminar.html',
  styleUrl: './seminar.scss',
})
export class Seminar implements OnInit, OnDestroy {
  private readonly parentRoute = '/application/workshopSeminar/seminar';
  private readonly fallbackTabs: SeminarTab[] = [
  ];
  private readonly isBrowser: boolean;
  private readonly refreshTabs = () => {
    this.loadTabs();
  };

  tabs: SeminarTab[] = this.fallbackTabs;

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
      .filter((menu) => menu.deletedFlag !== 1 && menu.parentId === parentId && isStoredMenuVisible(menu))
      .map((menu) => this.toSeminarTab(menu))
      .filter((tab): tab is SeminarTab => tab !== null);

    this.tabs = permittedTabs.length ? permittedTabs : this.fallbackTabs;
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
    return normalizeStoredMenus(value);
  }

  private toSeminarTab(menu: StoredMenu): SeminarTab | null {
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
    const route = url
      ?.trim()
      .replace(/\/+$/g, '')
      .replace('/application/workshop-seminar', '/application/workshopSeminar');

    if (!route) {
      return '';
    }

    return route.startsWith('/') ? route : `/${route}`;
  }
}
