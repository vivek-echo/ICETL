import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  StoredMenu,
  isStoredMenuVisible,
  normalizeStoredMenus,
} from '../../../commonServices/menu-utils';

interface EmployeeTab {
  id: number;
  label: string;
  route: string;
}

interface FilterToggleHost {
  showFilters: boolean;
  toggleFilters(): void;
}

@Component({
  selector: 'app-manage-employee',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './manage-employee.html',
  styleUrl: './manage-employee.scss',
})
export class ManageEmployee implements OnInit, OnDestroy {
  private readonly parentRoute = '/application/administration/manageEmployee';
  private readonly isBrowser: boolean;
  private readonly refreshTabs = () => {
    this.loadTabs();
  };

  tabs: EmployeeTab[] = [];
  activeFilterHost: FilterToggleHost | null = null;

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

  onRouteComponentActivate(component: unknown): void {
    this.activeFilterHost = this.isFilterToggleHost(component) ? component : null;
  }

  onRouteComponentDeactivate(): void {
    this.activeFilterHost = null;
  }

  get hasFilterToggle(): boolean {
    return this.activeFilterHost !== null;
  }

  get filtersVisible(): boolean {
    return this.activeFilterHost?.showFilters ?? false;
  }

  toggleActiveFilters(): void {
    this.activeFilterHost?.toggleFilters();
  }

  private loadTabs(): void {
    if (!this.isBrowser) {
      this.tabs = [];
      return;
    }

    const menus = this.readMenus();
    const parentMenu = menus.find((menu) => this.normalizeRoute(menu.url) === this.parentRoute);
    const parentId = parentMenu?.id ?? null;

    if (!parentId) {
      this.tabs = [];
      return;
    }

    const permittedTabs = menus
      .filter((menu) => menu.deletedFlag !== 1 && menu.parentId === parentId && isStoredMenuVisible(menu))
      .map((menu) => this.toEmployeeTab(menu))
      .filter((tab): tab is EmployeeTab => tab !== null);

    this.tabs = permittedTabs;
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

  private toEmployeeTab(menu: StoredMenu): EmployeeTab | null {
    const route = this.normalizeRoute(menu.url);

    if (!route.startsWith(`${this.parentRoute}/`)) {
      return null;
    }

    return {
      id: menu.id,
      label: this.getEmployeeTabLabel(route, menu.name),
      route: route.replace(`${this.parentRoute}/`, ''),
    };
  }

  private getEmployeeTabLabel(route: string, fallbackLabel: string): string {
    const labels: Record<string, string> = {
      [`${this.parentRoute}/addEmployee`]: 'Add Employee',
      [`${this.parentRoute}/viewUsers`]: 'View Users',
    };

    return labels[route] || fallbackLabel;
  }

  private normalizeRoute(url?: string | null): string {
    const route = url
      ?.trim()
      .replace(/\/+$/g, '')
      .replace('/application/adminstration', '/application/administration');

    if (!route) {
      return '';
    }

    return route.startsWith('/') ? route : `/${route}`;
  }

  private isFilterToggleHost(component: unknown): component is FilterToggleHost {
    const candidate = component as Partial<FilterToggleHost> | null;

    return (
      !!candidate &&
      typeof candidate.showFilters === 'boolean' &&
      typeof candidate.toggleFilters === 'function'
    );
  }
}
