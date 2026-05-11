import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { AuthService } from '../../commonServices/auth.service';
import { UserProfileService } from '../../commonServices/user-profile.service';

export const becomeInstructorGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);

  if (!authService.isLoggedIn()) {
    return true;
  }

  const alertHelper = inject(AlertHelperService);
  const userProfileService = inject(UserProfileService);
  const shouldLogout = await alertHelper.confirm(
    'You will be logged out to continue as an instructor. Do you want to proceed?',
    'Become an Instructor',
  );

  if (!shouldLogout) {
    return false;
  }

  try {
    await firstValueFrom(authService.logout());
  } catch {
    // Clear the local session even if the logout API request fails.
  }

  userProfileService.clearProfile();
  authService.logoutLocally(false);

  return true;
};
