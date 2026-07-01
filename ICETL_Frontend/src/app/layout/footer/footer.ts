import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
  readonly instructorEmailScrollState = { scrollToEmail: true };
  private readonly isBrowser: boolean;
  private readonly instructorEmailScrollEvent = 'become-instructor-scroll-email';

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly router: Router,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  requestInstructorEmailScroll(event: MouseEvent): void {
    if (!this.isBrowser || !this.isBecomeInstructorRoute()) {
      return;
    }

    event.preventDefault();
    window.dispatchEvent(new Event(this.instructorEmailScrollEvent));
  }

  private isBecomeInstructorRoute(): boolean {
    const currentRoute = this.router.url.split(/[?#]/)[0].replace(/\/+$/g, '');

    return currentRoute === '/become-instructor';
  }
}
