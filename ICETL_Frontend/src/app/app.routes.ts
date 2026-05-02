import { Routes } from '@angular/router';
import { websiteRoutes } from './website/website.routes';

export const routes: Routes = [
    {
        path: '',
        loadChildren: () => import('./website/website.routes').then(m => m.websiteRoutes)
    }
];