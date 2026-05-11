import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { SpinnerService } from './spinner.service';
import { SKIP_SPINNER } from './spinner.tokens';

let requestSequence = 0;

export const spinnerInterceptor: HttpInterceptorFn = (request, next) => {
  // Allow specific requests to opt out when a silent background refresh is needed.
  if (request.context.get(SKIP_SPINNER)) {
    return next(request);
  }

  const spinnerService = inject(SpinnerService);
  const requestKey = `http:${++requestSequence}`;

  spinnerService.show(requestKey);

  return next(request).pipe(
    // finalize runs for success, error, and completion, so the spinner always gets cleaned up.
    finalize(() => {
      spinnerService.hide(requestKey);
    }),
  );
};
