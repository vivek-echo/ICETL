import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appModalWindow]',
  standalone: true,
  exportAs: 'appModalWindow',
})
export class ModalWindowDirective {
  @Input() appModalWindowTitle = 'Modal';

  isMaximized = false;
  isMinimized = false;

  @HostBinding('class.app-modal-window') readonly modalWindowClass = true;

  @HostBinding('class.app-modal-window--maximized')
  get maximizedClass(): boolean {
    return this.isMaximized;
  }

  @HostBinding('class.app-modal-window--minimized')
  get minimizedClass(): boolean {
    return this.isMinimized;
  }

  @HostBinding('attr.tabindex') readonly tabIndex = '-1';

  minimize(): void {
    this.isMinimized = true;
    this.isMaximized = false;
  }

  restore(): void {
    this.isMinimized = false;
    this.isMaximized = false;
  }

  toggleMaximize(): void {
    this.isMinimized = false;
    this.isMaximized = !this.isMaximized;
  }
}
