import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface StoredMenu {
  id: number;
  name: string;
  type?: number;
  url?: string | null;
  icon?: string | null;
  parentId?: number | null;
  deletedFlag?: number;
}

interface DashboardSetting {
  dashboardName?: string;
  dashboardUrl?: string;
}

interface MenuNode extends StoredMenu {
  route: string | null;
  children: MenuNode[];
}

@Component({
  selector: 'app-side-nav',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.scss',
})
export class SideNav implements OnInit, OnDestroy {
  readonly defaultMenuIcon = 'feather-circle';
  private readonly applicationRootSegments = new Set(['admin', 'courses', 'instructor', 'learner']);
  private readonly parentActiveRoutes = new Set([
    '/application/courses/coursesCategories',
    '/application/courses/manageCourses',
  ]);
  menuItems: MenuNode[] = [];
  dashboardSetting: DashboardSetting | null = null;
  private readonly isBrowser: boolean;
  private readonly refreshMenuItems = () => {
    this.loadDashboardSetting();
    this.loadMenuItems();
  };

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadDashboardSetting();
    this.loadMenuItems();

    if (!this.isBrowser) {
      return;
    }

    window.addEventListener('storage', this.refreshMenuItems);
    window.addEventListener('auth-user-updated', this.refreshMenuItems);
    window.addEventListener('auth-session-cleared', this.refreshMenuItems);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) {
      return;
    }

    window.removeEventListener('storage', this.refreshMenuItems);
    window.removeEventListener('auth-user-updated', this.refreshMenuItems);
    window.removeEventListener('auth-session-cleared', this.refreshMenuItems);
  }

  private loadMenuItems(): void {
    if (!this.isBrowser) {
      this.menuItems = [];
      return;
    }

    const storedMenus = this.readMenusFromStorage('menus');
    const userMenus = this.readMenusFromAuthUser();
    const menus = (storedMenus.length ? storedMenus : userMenus).filter(
      (menu) => menu.deletedFlag !== 1,
    );

    this.menuItems = this.collapseMainPageTabMenus(this.buildMenuTree(menus));
  }

  private readMenusFromAuthUser(): StoredMenu[] {
    const user = this.readJson<{ menus?: unknown }>('auth_user');

    return this.normalizeMenus(user?.menus);
  }

  private readMenusFromStorage(key: string): StoredMenu[] {
    const value = this.readJson<unknown>(key);

    if (Array.isArray(value)) {
      return this.normalizeMenus(value);
    }

    return this.normalizeMenus((value as { menus?: unknown } | null)?.menus);
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

  private loadDashboardSetting(): void {
    if (!this.isBrowser) {
      this.dashboardSetting = null;
      return;
    }

    this.dashboardSetting = this.readJson<DashboardSetting>('dashboardsetting');
  }

  private buildMenuTree(menus: StoredMenu[]): MenuNode[] {
    const sortedMenus = [...menus].sort((left, right) => {
      const leftParentId = left.parentId ?? 0;
      const rightParentId = right.parentId ?? 0;

      return leftParentId - rightParentId || left.id - right.id;
    });

    const menuMap = new Map<number, MenuNode>();
    const rootMenus: MenuNode[] = [];

    sortedMenus.forEach((menu) => {
      menuMap.set(menu.id, {
        ...menu,
        route: this.resolveMenuRoute(menu.url),
        children: [],
      });
    });

    sortedMenus.forEach((menu) => {
      const menuNode = menuMap.get(menu.id);

      if (!menuNode) {
        return;
      }

      const parentId = menu.parentId ?? 0;
      const parentNode = parentId > 0 ? menuMap.get(parentId) : null;

      if (parentNode) {
        parentNode.children.push(menuNode);
        return;
      }

      rootMenus.push(menuNode);
    });

    return rootMenus;
  }

  private collapseMainPageTabMenus(menus: MenuNode[]): MenuNode[] {
    const flattenedMenus: MenuNode[] = [];

    menus.forEach((menu) => {
      const children = this.collapseMainPageTabMenus(menu.children);

      // If menu has no route and only contains children,
      // remove the tab and directly push children
      const isOnlyWrapper = !menu.route && children.length > 0;

      if (isOnlyWrapper) {
        flattenedMenus.push(...children);
        return;
      }

      flattenedMenus.push({
        ...menu,
        children,
      });
    });

    return flattenedMenus;
  }

  private normalizeMenuName(name?: string | null): string {
    return (name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  protected shouldUseExactActiveMatch(route: string | null): boolean {
    return route ? !this.parentActiveRoutes.has(route) : true;
  }

  private resolveMenuRoute(url?: string | null): string | null {
    const route = url?.trim();

    if (!route) {
      return null;
    }

    if (route.startsWith('/')) {
      return route;
    }

    if (route.startsWith('application/')) {
      return `/${route}`;
    }

    const rootSegment = route.split('/')[0];

    if (this.applicationRootSegments.has(rootSegment)) {
      return `/application/${route}`;
    }

    const dashboardSegment = this.dashboardSetting?.dashboardUrl?.trim().replace(/^\/+|\/+$/g, '');

    if (!dashboardSegment) {
      return `/application/${route}`;
    }

    if (route === dashboardSegment || route.startsWith(`${dashboardSegment}/`)) {
      return `/application/${route}`;
    }

    return `/application/${dashboardSegment}/${route}`;
  }

  getDashboardRoute(): string | null {
    return this.resolveMenuRoute(this.dashboardSetting?.dashboardUrl ?? null);
  }
}
