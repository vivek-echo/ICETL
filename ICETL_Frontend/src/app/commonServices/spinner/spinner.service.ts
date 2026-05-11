import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import {
  GLOBAL_SPINNER_NAME,
  SPINNER_MIN_VISIBLE_MS,
  SPINNER_SHOW_DELAY_MS,
} from './spinner.tokens';

@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  private readonly ngxSpinner = inject(NgxSpinnerService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Track active work items by key so concurrent API calls and route changes can share one spinner.
  private readonly activeOperations = new Map<string, number>();

  private showTimerId: ReturnType<typeof setTimeout> | null = null;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;
  private isVisible = false;
  private visibleAt = 0;

  /**
   * Shows the global spinner.
   * Pass a custom key when multiple async operations can overlap.
   */
  show(key = 'manual'): void {
    if (!this.isBrowser) {
      return;
    }

    this.activeOperations.set(key, (this.activeOperations.get(key) ?? 0) + 1);
    this.clearHideTimer();

    if (this.isVisible || this.showTimerId !== null) {
      return;
    }

    this.showTimerId = setTimeout(() => {
      this.showTimerId = null;

      if (!this.hasActiveOperations() || this.isVisible) {
        return;
      }

      this.isVisible = true;
      this.visibleAt = Date.now();
      void this.ngxSpinner.show(GLOBAL_SPINNER_NAME);
    }, SPINNER_SHOW_DELAY_MS);
  }

  /**
   * Hides the global spinner once every tracked async operation is finished.
   */
  hide(key = 'manual'): void {
    if (!this.isBrowser) {
      return;
    }

    this.decrementOperation(key);

    if (this.hasActiveOperations()) {
      return;
    }

    this.clearShowTimer();

    if (!this.isVisible) {
      return;
    }

    this.clearHideTimer();

    const elapsed = Date.now() - this.visibleAt;
    const remainingVisibleTime = Math.max(SPINNER_MIN_VISIBLE_MS - elapsed, 0);

    this.hideTimerId = setTimeout(() => {
      this.hideTimerId = null;

      if (this.hasActiveOperations()) {
        return;
      }

      this.isVisible = false;
      void this.ngxSpinner.hide(GLOBAL_SPINNER_NAME);
    }, remainingVisibleTime);
  }

  private decrementOperation(key: string): void {
    const currentCount = this.activeOperations.get(key);

    if (!currentCount) {
      return;
    }

    if (currentCount === 1) {
      this.activeOperations.delete(key);
      return;
    }

    this.activeOperations.set(key, currentCount - 1);
  }

  private hasActiveOperations(): boolean {
    return this.activeOperations.size > 0;
  }

  private clearShowTimer(): void {
    if (this.showTimerId !== null) {
      clearTimeout(this.showTimerId);
      this.showTimerId = null;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimerId !== null) {
      clearTimeout(this.hideTimerId);
      this.hideTimerId = null;
    }
  }
}
