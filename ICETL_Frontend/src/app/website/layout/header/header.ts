import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HEADER_CATEGORY_PANELS, MAIN_NAVIGATION } from '../../data/site-content';

type UtilityMenu = 'language' | 'currency' | null;

interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  readonly navigation = MAIN_NAVIGATION;
  readonly categoryPanels = HEADER_CATEGORY_PANELS;
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
  readonly activeCategoryPanel = computed(
    () =>
      this.categoryPanels.find((category) => category.id === this.activeCategoryId()) ??
      this.categoryPanels[0],
  );

  private readonly elementRef = inject(ElementRef<HTMLElement>);

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
}
