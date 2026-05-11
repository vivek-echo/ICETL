import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  GuardsCheckEnd,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterOutlet,
} from '@angular/router';
import { ApiService } from './services/api';
import { GlobalSpinnerComponent } from './commonServices/spinner/global-spinner.component';
import { SpinnerService } from './commonServices/spinner/spinner.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalSpinnerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly spinnerService = inject(SpinnerService);

  protected readonly title = signal('ICETL_Frontend');
  rolesList: any;

  constructor(private api: ApiService) {
    this.registerRouteSpinner();
  }

  ngOnInit() {
    // this.loadRolesList();
  }

  loadRolesList() {
    this.api.getRolesList().subscribe({
      next: (res) => {
        console.log('Roles List:', res);
        // this.rolesList = res;
      },
      error: (err) => {
        console.error('Error:', err);
      }
    });
  }

  private registerRouteSpinner(): void {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // Wait until guards finish so confirmation dialogs are not covered by the global loader.
        if (event instanceof GuardsCheckEnd && event.shouldActivate) {
          this.spinnerService.show(`route:${event.id}`);
          return;
        }

        if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          this.spinnerService.hide(`route:${event.id}`);
        }
      });
  }
}
