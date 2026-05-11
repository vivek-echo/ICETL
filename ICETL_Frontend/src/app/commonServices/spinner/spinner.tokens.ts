import { HttpContextToken } from '@angular/common/http';

// Shared spinner name so the service, interceptor, and UI all target the same loader instance.
export const GLOBAL_SPINNER_NAME = 'app-global-spinner';

// Small timing guards keep very fast requests from flashing the loader on screen.
export const SPINNER_SHOW_DELAY_MS = 150;
export const SPINNER_MIN_VISIBLE_MS = 250;

// Requests can opt out of the global spinner when needed.
export const SKIP_SPINNER = new HttpContextToken<boolean>(() => false);
