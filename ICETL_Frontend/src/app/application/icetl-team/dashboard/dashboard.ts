import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AdminDashboardData, DashboardService } from '../../services/dashboard.service';

interface TeamMetric {
  icon: string;
  label: string;
  helper: string;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  data: AdminDashboardData | null = null;
  loading = false;
  errorMessage = '';

  readonly shortcuts: TeamMetric[] = [
    {
      icon: 'feather-message-circle',
      label: 'Enquiries',
      helper: 'Review learner and instructor enquiries',
      route: '/application/enquiries',
    },
    {
      icon: 'feather-check-circle',
      label: 'Offline Approvals',
      helper: 'Review offline and special course workflow',
      route: '/application/courses/manageOfflineCourses/viewAllOfflineCourses',
    },
    {
      icon: 'feather-calendar',
      label: 'Workshops',
      helper: 'Coordinate workshop sessions',
      route: '/application/workshopSeminar/workshop/viewAllWorkshop',
    },
    {
      icon: 'feather-activity',
      label: 'Seminars',
      helper: 'Coordinate seminar sessions',
      route: '/application/workshopSeminar/seminar/viewAllSeminar',
    },
  ];

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.dashboardService.getAdminDashboard());
      this.data = response.data;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Workflow summary is not available for this role.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }
}
