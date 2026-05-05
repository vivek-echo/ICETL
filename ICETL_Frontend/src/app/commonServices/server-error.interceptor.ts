import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, retry } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertHelperService } from './alert-helper-service';
import { HTTP_STATUS } from './http-status.constants';

export const serverErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const alertHelper = inject(AlertHelperService);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const getBackendMessage = (error: HttpErrorResponse, fallback: string): string => {
    const payload = error.error;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    return payload?.message || payload?.msg || error.message || fallback;
  };

  const handleBadRequest = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'Error', getBackendMessage(error, 'Something went wrong. Please try again.'));
  };

  const handleForbidden = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert(
      'error',
      'Forbidden',
      getBackendMessage(error, 'You do not have permission to perform this action.'),
    );
  };

  const handleNotFound = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'Not Found', getBackendMessage(error, 'The requested resource was not found.'));
  };

  const handleValidationErrors = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;

    const validationPayload = error.error?.errors || error.error?.msg || error.error?.message;
    let errorMessage = '';

    if (typeof validationPayload === 'string') {
      errorMessage += `<i class="fa-solid fa-arrow-right text-danger"></i> ${validationPayload}<br>`;
    } else if (validationPayload && typeof validationPayload === 'object') {
      Object.values(validationPayload).forEach((messages: unknown) => {
        if (Array.isArray(messages)) {
          messages.forEach((message) => {
            errorMessage += `<i class="fa-solid fa-arrow-right text-danger"></i> ${message}<br>`;
          });
        } else if (typeof messages === 'string') {
          errorMessage += `<i class="fa-solid fa-arrow-right text-danger"></i> ${messages}<br>`;
        }
      });
    }

    if (!errorMessage) {
      errorMessage = '<i class="fa-solid fa-arrow-right text-danger"></i> Invalid data provided.';
    }

    return alertHelper.viewAlertHtml('error', 'VALIDATION_ERROR', errorMessage);
  };

  const handleConflict = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'Conflict', getBackendMessage(error, 'The request conflicts with the current state.'));
  };

  const handleTooManyRequests = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'Too Many Requests', getBackendMessage(error, 'Please wait before trying again.'));
  };

  const handleDBErrors = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'QUERY_EXECUTION_ERROR', getBackendMessage(error, 'A database error occurred.'));
  };

  const handleServerError = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;
    return alertHelper.viewAlert('error', 'Server Error', getBackendMessage(error, 'A server error occurred. Please try again later.'));
  };

  const handleUnexpectedError = (error: HttpErrorResponse) => {
    if (!isBrowser) return null;

    if (environment.production) {
      console.log('Non-critical error suppressed.');
      return null;
    }

    return alertHelper.viewAlert('error', 'Error', getBackendMessage(error, 'An unexpected error occurred. Please try again.'));
  };

  return next(request).pipe(
    retry(0),
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case HTTP_STATUS.BAD_REQUEST:
          void handleBadRequest(error);
          break;
        case HTTP_STATUS.FORBIDDEN:
          void handleForbidden(error);
          break;
        case HTTP_STATUS.NOT_FOUND:
          void handleNotFound(error);
          break;
        case HTTP_STATUS.CONFLICT:
          void handleConflict(error);
          break;
        case HTTP_STATUS.UNPROCESSABLE_ENTITY:
          void handleValidationErrors(error);
          break;
        case HTTP_STATUS.LOCKED:
          void handleDBErrors(error);
          break;
        case HTTP_STATUS.TOO_MANY_REQUESTS:
          void handleTooManyRequests(error);
          break;
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
          void handleServerError(error);
          break;
        default:
          if (error.status !== HTTP_STATUS.UNAUTHORIZED) {
            void handleUnexpectedError(error);
          }
      }

      return throwError(() => error);
    })
  );
};
