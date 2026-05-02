import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DASHBOARD_METRICS, DASHBOARD_PROGRESS, UPCOMING_SESSIONS } from '../../data/site-content';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  readonly metrics = DASHBOARD_METRICS;
  readonly progressList = DASHBOARD_PROGRESS;
  readonly sessions = UPCOMING_SESSIONS;
}
