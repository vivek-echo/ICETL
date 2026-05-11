import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertHelperService } from './alert-helper-service';
import { HTTP_STATUS } from './http-status.constants';

let isHandlingSessionExpiry = false;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const alertHelper = inject(AlertHelperService);
  const modalService = inject(NgbModal);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);
  const token = isBrowser ? localStorage.getItem('auth_token') : null;
  const isApiRequest = request.url.startsWith(environment.apiUrl);
  const isLoginRequest = request.url === `${environment.apiUrl}/login`;

  const updatedRequest =
    isApiRequest
      ? request.clone({
          setHeaders: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json'
          }
        })
      : request;

  const handleSessionExpired = () => {
    if (!isBrowser || isHandlingSessionExpiry) {
      return Promise.resolve();
    }

    isHandlingSessionExpiry = true;

    return alertHelper.viewAlert('error', 'EXPIRED', 'Session Expired! Please log in again.').then(() => {
      modalService.dismissAll();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_expires_at');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('dashboardsetting');
      localStorage.removeItem('menus');
      window.dispatchEvent(new Event('auth-session-cleared'));
      void router.navigate(['/login']);
    }).finally(() => {
      isHandlingSessionExpiry = false;
    });
  };

  return next(updatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === HTTP_STATUS.UNAUTHORIZED &&
        !isLoginRequest &&
        token
      ) {
        void handleSessionExpired();
      }

      return throwError(() => error);
    })
  );
};
