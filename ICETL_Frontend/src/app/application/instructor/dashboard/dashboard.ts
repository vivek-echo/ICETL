import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { DashboardChartPoint, DashboardService, InstructorDashboardData } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  data: InstructorDashboardData | null = null;
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
      const response = await lastValueFrom(this.dashboardService.getInstructorDashboard());
      this.data = response.data;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Unable to load instructor dashboard.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  formatAmount(value: number | string | null | undefined): string {
    return this.amountFormatter.format(Number(value) || 0);
  }

  chartWidth(point: DashboardChartPoint): number {
    if (point.value <= 0) {
      return 0;
    }

    const max = Math.max(...(this.data?.courseStatus ?? []).map((item) => item.value), 1);

    return Math.max(4, Math.round((point.value / max) * 100));
  }
}
