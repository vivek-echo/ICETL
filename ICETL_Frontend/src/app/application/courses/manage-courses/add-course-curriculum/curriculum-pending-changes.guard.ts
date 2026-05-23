import { CanDeactivateFn } from '@angular/router';

export interface PendingChangesComponent {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const curriculumPendingChangesGuard: CanDeactivateFn<PendingChangesComponent> = (
  component,
) => component.canDeactivate();
