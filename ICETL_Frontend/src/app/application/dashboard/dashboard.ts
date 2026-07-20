import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import {
  AdminDashboardData,
  DashboardChartPoint,
  DashboardMetric,
  DynamicDashboardData,
  DashboardService,
  InstructorDashboardData,
  LearnerDashboardData,
  WorkflowActivity,
} from '../services/dashboard.service';
import { AuthService } from '../../commonServices/auth.service';
import { StoredUser } from '../../commonServices/auth-navigation';

type ChartKind = 'bar' | 'column' | 'donut';

interface DashboardChartSeries {
  id: string;
  label: string;
  helper: string;
  kind: ChartKind;
  points: DashboardChartPoint[];
}

@Component({
  selector: 'app-dynamic-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DynamicDashboard implements OnInit {
  data: DynamicDashboardData | null = null;
  loading = false;
  errorMessage = '';
  selectedChartId = '';

  private readonly chartColors = ['#2457e6', '#6554f2', '#0f766e', '#f59e0b', '#e11d48', '#0891b2'];

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authService: AuthService,
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
      const response = await lastValueFrom(this.dashboardService.getCurrentDashboard());
      this.data = response.data;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Unable to load dashboard right now.';
      this.data = this.buildLocalFallbackDashboard();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get roleName(): string {
    return this.data?.role.name || this.currentUser.dashboard?.dashboardName || 'Your Workspace';
  }

  get summaryCards(): DashboardMetric[] {
    return this.data?.summary ?? [];
  }

  get activityItems(): WorkflowActivity[] {
    return this.data?.activity ?? [];
  }

  get chartSeries(): DashboardChartSeries[] {
    if (!this.data) {
      return [];
    }

    const payload = this.data.payload;

    if (this.data.kind === 'admin') {
      return this.adminCharts(payload as AdminDashboardData);
    }

    if (this.data.kind === 'instructor') {
      return this.instructorCharts(payload as InstructorDashboardData);
    }

    if (this.data.kind === 'learner') {
      return this.learnerCharts(payload as LearnerDashboardData);
    }

    return this.genericCharts();
  }

  get activeChart(): DashboardChartSeries | null {
    const series = this.chartSeries;

    return series.find((chart) => chart.id === this.selectedChartId) ?? series[0] ?? null;
  }

  formatValue(value: number | string | null | undefined): string {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
    }

    return `${value ?? 0}`;
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

  reloadDashboard(): void {
    void this.loadDashboard();
  }

  selectChart(chartId: string): void {
    this.selectedChartId = chartId;
  }

  chartTotal(chart: DashboardChartSeries): number {
    return chart.points.reduce((total, point) => total + this.toNumber(point.value), 0);
  }

  pointPercent(point: DashboardChartPoint, chart: DashboardChartSeries): number {
    const total = this.chartTotal(chart);

    if (total <= 0) {
      return 0;
    }

    return Math.round((this.toNumber(point.value) / total) * 100);
  }

  barSize(point: DashboardChartPoint, chart: DashboardChartSeries): number {
    const max = Math.max(...chart.points.map((item) => this.toNumber(item.value)), 1);

    return Math.max(4, Math.round((this.toNumber(point.value) / max) * 100));
  }

  pointColor(index: number): string {
    return this.chartColors[index % this.chartColors.length] ?? this.chartColors[0];
  }

  donutGradient(chart: DashboardChartSeries): string {
    const total = this.chartTotal(chart);

    if (total <= 0) {
      return 'conic-gradient(#e8edf5 0 100%)';
    }

    let cursor = 0;
    const segments = chart.points.map((point, index) => {
      const size = (this.toNumber(point.value) / total) * 100;
      const start = cursor;
      const end = cursor + size;
      cursor = end;

      return `${this.pointColor(index)} ${start}% ${end}%`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }

  private get currentUser(): StoredUser {
    return this.authService.getUser() as StoredUser;
  }

  private buildLocalFallbackDashboard(): DynamicDashboardData {
    const user = this.currentUser;

    return {
      role: {
        id: Number.isFinite(Number(user.role)) ? Number(user.role) : null,
        name: user.dashboard?.dashboardName || 'Your Workspace',
        dashboardUrl: user.dashboard?.dashboardUrl ?? 'dashboard',
      },
      kind: 'generic',
      summary: [],
      menuModules: [],
      activity: [],
      payload: {},
    };
  }

  private adminCharts(payload: AdminDashboardData | undefined): DashboardChartSeries[] {
    return [
      this.toSeries('monthlyRevenue', 'Revenue Trend', 'Last 6 months', 'column', payload?.monthlyRevenue),
      this.toSeries('userRoles', 'User Roles', 'Account mix', 'bar', payload?.userRoles),
      this.toSeries('courseCategories', 'Course Categories', 'Top categories', 'bar', payload?.courseCategories),
      this.toSeries(
        'workflow',
        'Workflow Queue',
        'Current operational load',
        'donut',
        this.workflowSummaryPoints(payload?.workflow?.summary),
      ),
    ].filter((series): series is DashboardChartSeries => Boolean(series));
  }

  private instructorCharts(payload: InstructorDashboardData | undefined): DashboardChartSeries[] {
    return [
      this.toSeries('courseStatus', 'Course Status', 'Course availability', 'donut', payload?.courseStatus),
      this.toSeries(
        'offlineCourseStatus',
        'Offline Course Status',
        'Approval pipeline',
        'bar',
        payload?.workflow?.offlineCourseStatus,
      ),
      this.toSeries(
        'topCourses',
        'Top Courses',
        'Learner count',
        'column',
        payload?.topCourses?.map((course) => ({
          label: course.title,
          value: this.toNumber(course.students),
        })),
      ),
      this.toSeries(
        'workflow',
        'Teaching Workflow',
        'Assigned work',
        'donut',
        this.workflowSummaryPoints(payload?.workflow?.summary),
      ),
    ].filter((series): series is DashboardChartSeries => Boolean(series));
  }

  private learnerCharts(payload: LearnerDashboardData | undefined): DashboardChartSeries[] {
    return [
      this.toSeries('progressBreakdown', 'Learning Progress', 'Enrollment progress', 'donut', payload?.progressBreakdown),
      this.toSeries(
        'paymentSummary',
        'Payment Status',
        'Orders and installments',
        'bar',
        this.paymentSummaryPoints(payload?.workflow?.paymentSummary),
      ),
      this.toSeries(
        'continueLearning',
        'Continue Learning',
        'Course progress',
        'column',
        payload?.workflow?.continueLearning?.map((course) => ({
          label: course.title,
          value: this.toNumber(course.progressPercent),
        })),
      ),
      this.toSeries(
        'workflow',
        'Learning Workflow',
        'Ready actions',
        'donut',
        this.workflowSummaryPoints(payload?.workflow?.summary),
      ),
    ].filter((series): series is DashboardChartSeries => Boolean(series));
  }

  private genericCharts(): DashboardChartSeries[] {
    return [
      this.toSeries(
        'summary',
        'Workspace Summary',
        'Current totals',
        'bar',
        this.summaryCards.map((metric) => ({
          label: metric.label,
          value: this.toNumber(metric.value),
        })),
      ),
    ].filter((series): series is DashboardChartSeries => Boolean(series));
  }

  private toSeries(
    id: string,
    label: string,
    helper: string,
    kind: ChartKind,
    points: DashboardChartPoint[] | undefined,
  ): DashboardChartSeries | null {
    const normalizedPoints = this.normalizePoints(points);

    if (!normalizedPoints.length) {
      return null;
    }

    return {
      id,
      label,
      helper,
      kind,
      points: normalizedPoints,
    };
  }

  private normalizePoints(points: DashboardChartPoint[] | undefined): DashboardChartPoint[] {
    if (!Array.isArray(points)) {
      return [];
    }

    return points
      .map((point) => ({
        label: `${point.label ?? ''}`.trim() || 'Item',
        value: this.toNumber(point.value),
      }))
      .filter((point) => point.value > 0)
      .slice(0, 8);
  }

  private workflowSummaryPoints(summary: object | undefined): DashboardChartPoint[] {
    if (!summary) {
      return [];
    }

    return Object.entries(summary as Record<string, unknown>)
      .map(([key, value]) => ({
        label: this.labelize(key),
        value: this.toNumber(value),
      }))
      .filter((point) => point.value > 0)
      .slice(0, 6);
  }

  private paymentSummaryPoints(summary: object | undefined): DashboardChartPoint[] {
    if (!summary) {
      return [];
    }
    const values = summary as Record<string, unknown>;

    return [
      { label: 'Paid Orders', value: this.toNumber(values['paidOrders']) },
      { label: 'Pending Orders', value: this.toNumber(values['pendingOrders']) },
      { label: 'Failed Orders', value: this.toNumber(values['failedOrders']) },
      { label: 'Pending Installments', value: this.toNumber(values['pendingInstallments']) },
      { label: 'Overdue Installments', value: this.toNumber(values['overdueInstallments']) },
    ].filter((point) => point.value > 0);
  }

  private labelize(value: string): string {
    return value
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (first) => first.toUpperCase());
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number(`${value ?? ''}`.replace(/[^0-9.-]+/g, ''));

    return Number.isFinite(parsed) ? parsed : 0;
  }
}
