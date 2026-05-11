import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { AuthService } from '../../commonServices/auth.service';
import { HEADER_CATEGORY_PANELS } from '../../data/site-content';
import { NavigationService } from '../../commonServices/nav-item-service';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { UserProfile, UserProfileService } from '../../commonServices/user-profile.service';

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
  profileImgUrl?: string | null;
  thumbnailImgUrl?: string | null;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly navItemService = inject(NavigationService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly alertHelper = inject(AlertHelperService);
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private profileSyncTimer: ReturnType<typeof setTimeout> | null = null;
  navItems$ = this.navItemService.navItems$;
  readonly categoryPanels = HEADER_CATEGORY_PANELS;
  readonly profileRoute = '/application/studentDashboard';
  readonly socialLinks = [
    { label: 'Facebook', href: 'https://www.facebook.com/icetechnologylab', iconClass: 'fab fa-facebook-f' },
    { label: 'Twitter', href: 'https://x.com/icetlindia', iconClass: 'fab fa-twitter' },
    { label: 'LinkedIn', href: 'https://in.linkedin.com/company/ice-technology-lab', iconClass: 'fab fa-linkedin-in' },
    { label: 'Instagram', href: 'https://www.instagram.com/icetlindia/', iconClass: 'fab fa-instagram' },
    { label: 'YouTube', href: 'https://www.youtube.com/@icetechnologylab2073', iconClass: 'fab fa-youtube' },
  ];

  readonly languages: LanguageOption[] = [
    { code: 'en', label: 'English', flag: 'assets/images/icons/en-us.png' },
    { code: 'fr', label: 'French', flag: 'assets/images/icons/fr.png' },
    { code: 'de', label: 'German', flag: 'assets/images/icons/de.png' },
  ];
  readonly currencies = ['USD', 'EUR', 'GBP'];
  readonly phoneNumber = '+91 8797078611 , +91 8797078612';

  readonly selectedLanguage = signal<LanguageOption>(this.languages[0]);
  readonly selectedCurrency = signal(this.currencies[0]);
  readonly isTopbarExpanded = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly isDesktopCategoryOpen = signal(false);
  readonly openDesktopDropdown = signal<string | null>(null);
  readonly openMobileSection = signal<string | null>(null);
  readonly openUtilityMenu = signal<UtilityMenu>(null);
  readonly activeCategoryId = signal(this.categoryPanels[0]?.id ?? '');
  readonly currentUser = signal<AuthUser | null>(
    this.userProfileService.currentProfile
      ? this.mapProfileToAuthUser(this.userProfileService.currentProfile)
      : this.readCurrentUser(),
  );
  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly currentUserDisplayName = computed(() => this.currentUser()?.name ?? 'Learner');
  readonly currentUserShortName = computed(
    () => this.currentUserDisplayName().trim().split(/\s+/)[0] || 'Account',
  );
  readonly currentUserEmail = computed(() => this.currentUser()?.email || 'Signed in learner');
  readonly currentUserAvatarUrl = computed(
    () => this.currentUser()?.thumbnailImgUrl || this.currentUser()?.profileImgUrl || '',
  );
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

  ngOnInit(): void {
    this.subscriptions.add(
      this.userProfileService.profile$.subscribe((profile) => {
        this.scheduleCurrentUserSync(profile);
      }),
    );
  }

  ngOnDestroy(): void {
    this.clearProfileSyncTimer();
    this.subscriptions.unsubscribe();
  }

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
    this.userProfileService.clearProfile();
    this.authService.logoutLocally(false);
    this.currentUser.set(null);
    this.closeAllMenus();

    this.router.navigate(['/login']);
  }

  @HostListener('window:auth-session-cleared')
  handleAuthSessionCleared(): void {
    this.userProfileService.clearProfile();
    this.currentUser.set(null);
    this.closeAllMenus();
    this.navItemService.loadNavigation();
  }

  @HostListener('window:auth-user-updated')
  handleAuthUserUpdated(): void {
    const profile = this.userProfileService.loadProfileFromStorage();

    this.currentUser.set(profile ? this.mapProfileToAuthUser(profile) : this.readCurrentUser());
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
        profileImgUrl: this.sanitizeDisplayUrl(user.profileImgUrl),
        thumbnailImgUrl: this.sanitizeDisplayUrl(user.thumbnailImgUrl),
      };
    } catch {
      return {
        name: 'Learner',
        email: '',
      };
    }
  }

  private mapProfileToAuthUser(profile: UserProfile): AuthUser {
    return {
      id: profile.id,
      name: profile.name?.trim() || 'Learner',
      email: profile.email?.trim() || '',
      profileImgUrl: profile.profileImgUrl ?? null,
      thumbnailImgUrl: profile.thumbnailImgUrl ?? null,
    };
  }

  private sanitizeDisplayUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    return value.startsWith('blob:') || value.startsWith('data:') ? value : null;
  }

  private scheduleCurrentUserSync(profile: UserProfile | null): void {
    this.clearProfileSyncTimer();

    this.profileSyncTimer = setTimeout(() => {
      this.currentUser.set(profile ? this.mapProfileToAuthUser(profile) : null);
    });
  }

  private clearProfileSyncTimer(): void {
    if (this.profileSyncTimer) {
      clearTimeout(this.profileSyncTimer);
      this.profileSyncTimer = null;
    }
  }
}
