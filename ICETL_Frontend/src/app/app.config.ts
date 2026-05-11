import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideSpinnerConfig } from 'ngx-spinner';
import { authInterceptor } from './commonServices/auth.interceptor';
import { serverErrorInterceptor } from './commonServices/server-error.interceptor';
import { spinnerInterceptor } from './commonServices/spinner/spinner.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Standalone equivalent of BrowserAnimationsModule for Angular 21 applications.
    provideAnimationsAsync(),
    provideSpinnerConfig({ type: 'ball-scale-multiple' }),
    provideHttpClient(
      withInterceptors([spinnerInterceptor, authInterceptor, serverErrorInterceptor]),
    ),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
  ],
};
