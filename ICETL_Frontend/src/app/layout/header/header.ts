import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { AuthService } from '../../commonServices/auth.service';
import { HEADER_CATEGORY_PANELS } from '../../data/site-content';
import { NavigationService } from '../../commonServices/nav-item-service';
import { AsyncPipe } from '@angular/common';

type UtilityMenu = 'language' | 'currency' | 'account' | null;

interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

interface AuthUser {
  id?: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  private readonly navItemService = inject(NavigationService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly alertHelper = inject(AlertHelperService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  navItems$ = this.navItemService.navItems$;
  readonly categoryPanels = HEADER_CATEGORY_PANELS;
  readonly profileRoute = '/application/studentDashboard';
  readonly socialLinks = [
    { label: 'Facebook', href: 'https://www.facebook.com/', iconClass: 'fab fa-facebook-f' },
    { label: 'Twitter', href: 'https://www.twitter.com/', iconClass: 'fab fa-twitter' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/', iconClass: 'fab fa-linkedin-in' },
    { label: 'Instagram', href: 'https://www.instagram.com/', iconClass: 'fab fa-instagram' },
  ];

  readonly languages: LanguageOption[] = [
    { code: 'en', label: 'English', flag: 'assets/images/icons/en-us.png' },
    { code: 'fr', label: 'French', flag: 'assets/images/icons/fr.png' },
    { code: 'de', label: 'German', flag: 'assets/images/icons/de.png' },
  ];
  readonly currencies = ['USD', 'EUR', 'GBP'];
  readonly phoneNumber = '+1-202-555-0174';

  readonly selectedLanguage = signal<LanguageOption>(this.languages[0]);
  readonly selectedCurrency = signal(this.currencies[0]);
  readonly isTopbarExpanded = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly isDesktopCategoryOpen = signal(false);
  readonly openDesktopDropdown = signal<string | null>(null);
  readonly openMobileSection = signal<string | null>(null);
  readonly openUtilityMenu = signal<UtilityMenu>(null);
  readonly activeCategoryId = signal(this.categoryPanels[0]?.id ?? '');
  readonly currentUser = signal<AuthUser | null>(this.readCurrentUser());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly currentUserDisplayName = computed(() => this.currentUser()?.name ?? 'Learner');
  readonly currentUserShortName = computed(
    () => this.currentUserDisplayName().trim().split(/\s+/)[0] || 'Account',
  );
  readonly currentUserEmail = computed(() => this.currentUser()?.email || 'Signed in learner');
  readonly userInitials = computed(() =>
    this.currentUserDisplayName()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );
  readonly activeCategoryPanel = computed(
    () =>
      this.categoryPanels.find((category) => category.id === this.activeCategoryId()) ??
      this.categoryPanels[0],
  );

  toggleTopbar(): void {
    this.isTopbarExpanded.update((isExpanded) => !isExpanded);
  }

  toggleDesktopCategory(): void {
    this.isDesktopCategoryOpen.update((isOpen) => !isOpen);
    this.openDesktopDropdown.set(null);
    this.openUtilityMenu.set(null);
  }

  selectCategory(categoryId: string): void {
    this.activeCategoryId.set(categoryId);
  }

  toggleDesktopDropdown(menuLabel: string): void {
    this.openDesktopDropdown.update((current) => (current === menuLabel ? null : menuLabel));
    this.isDesktopCategoryOpen.set(false);
    this.openUtilityMenu.set(null);
  }

  toggleUtilityMenu(menu: UtilityMenu): void {
    this.openUtilityMenu.update((current) => (current === menu ? null : menu));
    this.openDesktopDropdown.set(null);
    this.isDesktopCategoryOpen.set(false);
  }

  toggleAccountMenu(event: Event): void {
    event.preventDefault();
    this.toggleUtilityMenu('account');
  }

  setLanguage(language: LanguageOption): void {
    this.selectedLanguage.set(language);
    this.openUtilityMenu.set(null);
  }

  setCurrency(currency: string): void {
    this.selectedCurrency.set(currency);
    this.openUtilityMenu.set(null);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
    this.openMobileSection.set(null);
  }

  toggleMobileSection(section: string): void {
    this.openMobileSection.update((current) => (current === section ? null : section));
  }

  closeFloatingMenus(): void {
    this.isDesktopCategoryOpen.set(false);
    this.openDesktopDropdown.set(null);
    this.openUtilityMenu.set(null);
  }

  closeAllMenus(): void {
    this.closeFloatingMenus();
    this.closeMobileMenu();
    this.isTopbarExpanded.set(false);
  }

  async logoutUser(event: Event): Promise<void> {
    event.preventDefault();

    const shouldLogout = await this.alertHelper.confirm(
      'You will be signed out of your account.',
      'Confirm logout',
    );

    if (!shouldLogout) return;

    this.authService.logout().subscribe({
      next: () => {
        this.handleLogoutSuccess();
      },
      error: () => {
        // Even if API fails, force logout locally
        this.handleLogoutSuccess();
      },
    });
  }

  private handleLogoutSuccess(): void {
    localStorage.clear(); // or remove specific keys

    this.currentUser.set(null);
    this.closeAllMenus();
    this.navItemService.loadNavigation();

    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeFloatingMenus();
      this.isTopbarExpanded.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeAllMenus();
  }

  private readCurrentUser(): AuthUser | null {
    if (!this.authService.isLoggedIn()) {
      return null;
    }

    try {
      const user = this.authService.getUser() as Partial<AuthUser>;

      return {
        id: user.id,
        name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : 'Learner',
        email: typeof user.email === 'string' ? user.email.trim() : '',
      };
    } catch {
      return {
        name: 'Learner',
        email: '',
      };
    }
  }
}
