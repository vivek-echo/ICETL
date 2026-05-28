import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { DashboardChartPoint, DashboardService, LearnerDashboardData } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  data: LearnerDashboardData | null = null;
  loading = false;
  errorMessage = '';

  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

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
      const response = await lastValueFrom(this.dashboardService.getLearnerDashboard());
      this.data = response.data;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Unable to load dashboard right now.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
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

  chartWidth(point: DashboardChartPoint): number {
    if (point.value <= 0) {
      return 0;
    }

    const max = Math.max(...(this.data?.progressBreakdown ?? []).map((item) => item.value), 1);

    return Math.max(4, Math.round((point.value / max) * 100));
  }
}
