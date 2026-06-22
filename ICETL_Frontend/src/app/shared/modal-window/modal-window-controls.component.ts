import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalWindowDirective } from './modal-window.directive';

@Component({
  selector: 'app-modal-window-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-modal-window-controls" role="group" aria-label="Modal window controls">
      <button
        type="button"
        class="app-modal-window-control"
        (click)="modal.minimize()"
        aria-label="Minimize modal"
        title="Minimize">
        <i class="fa-solid fa-window-minimize" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="app-modal-window-control"
        (click)="toggleSize()"
        [attr.aria-label]="sizeControlLabel"
        [title]="sizeControlTitle">
        <i
          [class]="sizeControlIcon"
          aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="app-modal-window-control app-modal-window-control--close"
        (click)="closed.emit()"
        [attr.aria-label]="closeLabel"
        title="Close">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  `,
})
export class ModalWindowControlsComponent {
  @Input({ required: true }) modal!: ModalWindowDirective;
  @Input() closeLabel = 'Close modal';
  @Output() closed = new EventEmitter<void>();

  get sizeControlLabel(): string {
    if (this.modal?.isMinimized) {
      return 'Restore modal';
    }

    return this.modal?.isMaximized ? 'Restore modal' : 'Maximize modal';
  }

  get sizeControlTitle(): string {
    if (this.modal?.isMinimized) {
      return 'Restore';
    }

    return this.modal?.isMaximized ? 'Restore' : 'Maximize';
  }

  get sizeControlIcon(): string {
    if (this.modal?.isMinimized) {
      return 'fa-regular fa-window-restore';
    }

    return this.modal?.isMaximized ? 'fa-solid fa-compress' : 'fa-regular fa-square';
  }

  toggleSize(): void {
    if (this.modal.isMinimized) {
      this.modal.restore();
      return;
    }

    this.modal.toggleMaximize();
  }
}
