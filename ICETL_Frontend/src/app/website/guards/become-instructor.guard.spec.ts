import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AlertHelperService } from '../../commonServices/alert-helper-service';
import { AuthService } from '../../commonServices/auth.service';
import { UserProfileService } from '../../commonServices/user-profile.service';
import { becomeInstructorGuard } from './become-instructor.guard';

describe('becomeInstructorGuard', () => {
  let authService: {
    isLoggedIn: jasmine.Spy;
    logout: jasmine.Spy;
    logoutLocally: jasmine.Spy;
  };
  let alertHelper: {
    confirm: jasmine.Spy;
  };
  let userProfileService: {
    clearProfile: jasmine.Spy;
  };

  beforeEach(() => {
    authService = {
      isLoggedIn: jasmine.createSpy('isLoggedIn'),
      logout: jasmine.createSpy('logout'),
      logoutLocally: jasmine.createSpy('logoutLocally'),
    };
    alertHelper = {
      confirm: jasmine.createSpy('confirm'),
    };
    userProfileService = {
      clearProfile: jasmine.createSpy('clearProfile'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: AlertHelperService, useValue: alertHelper },
        { provide: UserProfileService, useValue: userProfileService },
      ],
    });
  });

  it('allows access immediately when the user is not logged in', async () => {
    authService.isLoggedIn.and.returnValue(false);

    const canActivate = await TestBed.runInInjectionContext(() =>
      becomeInstructorGuard({} as never, {} as never),
    );

    expect(canActivate).toBeTrue();
    expect(alertHelper.confirm).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('blocks navigation when the logged-in user cancels the prompt', async () => {
    authService.isLoggedIn.and.returnValue(true);
    alertHelper.confirm.and.resolveTo(false);

    const canActivate = await TestBed.runInInjectionContext(() =>
      becomeInstructorGuard({} as never, {} as never),
    );

    expect(canActivate).toBeFalse();
    expect(authService.logout).not.toHaveBeenCalled();
    expect(authService.logoutLocally).not.toHaveBeenCalled();
  });

  it('logs out and allows navigation when the user confirms', async () => {
    authService.isLoggedIn.and.returnValue(true);
    authService.logout.and.returnValue(of({}));
    alertHelper.confirm.and.resolveTo(true);

    const canActivate = await TestBed.runInInjectionContext(() =>
      becomeInstructorGuard({} as never, {} as never),
    );

    expect(canActivate).toBeTrue();
    expect(authService.logout).toHaveBeenCalled();
    expect(userProfileService.clearProfile).toHaveBeenCalled();
    expect(authService.logoutLocally).toHaveBeenCalledWith(false);
  });

  it('still clears the local session when the logout API call fails', async () => {
    authService.isLoggedIn.and.returnValue(true);
    authService.logout.and.returnValue(throwError(() => new Error('logout failed')));
    alertHelper.confirm.and.resolveTo(true);

    const canActivate = await TestBed.runInInjectionContext(() =>
      becomeInstructorGuard({} as never, {} as never),
    );

    expect(canActivate).toBeTrue();
    expect(userProfileService.clearProfile).toHaveBeenCalled();
    expect(authService.logoutLocally).toHaveBeenCalledWith(false);
  });
});
