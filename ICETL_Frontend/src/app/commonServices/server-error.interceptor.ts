import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertHelperService } from './alert-helper-service';
import { HTTP_STATUS } from './http-status.constants';

export const serverErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const alertHelper = inject(AlertHelperService);

  const handleBadRequest = () => {
    return alertHelper.viewAlert('error', 'Error', 'Something went wrong. Please try again.');
  };

  const handleNotFound = () => {
    return alertHelper.viewAlert('error', 'Not Found', 'The requested resource was not found.');
  };

  const handleDBErrors = (error: HttpErrorResponse) => {
    const message = error.error?.msg || error.error?.message || 'A database error occurred.';
    return alertHelper.viewAlert('error', 'QUERY_EXECUTION_ERROR', message);
  };

  const handleValidationErrors = (error: HttpErrorResponse) => {
    const validationPayload = error.error?.errors || error.error?.msg;
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

  const handleServerError = () => {
    return alertHelper.viewAlert('error', 'Server Error', 'A server error occurred. Please try again later.');
  };

  const handleUnexpectedError = () => {
    if (environment.production) {
      console.log('Non-critical error suppressed.');
      return null;
    }

    return alertHelper.viewAlert('error', 'Error', 'An unexpected error occurred. Please try again.');
  };

  return next(request).pipe(
    retry(0),
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case HTTP_STATUS.BAD_REQUEST:
          void handleBadRequest();
          break;
        case HTTP_STATUS.NOT_FOUND:
          void handleNotFound();
          break;
        case HTTP_STATUS.UNPROCESSABLE_ENTITY:
          void handleValidationErrors(error);
          break;
        case HTTP_STATUS.LOCKED:
          void handleDBErrors(error);
          break;
        case HTTP_STATUS.INTERNAL_SERVER_ERROR:
          void handleServerError();
          break;
        default:
          if (error.status !== HTTP_STATUS.UNAUTHORIZED) {
            void handleUnexpectedError();
          }
      }

      return throwError(() => error);
    })
  );
};
