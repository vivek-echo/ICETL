import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'application',
        loadChildren: () => import('./application/application.routes').then(m => m.applicationRoutes)
    },
    {
        path: '',
        loadChildren: () => import('./website/website.routes').then(m => m.websiteRoutes)
    },
];
