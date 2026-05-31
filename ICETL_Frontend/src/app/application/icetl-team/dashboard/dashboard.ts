import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TeamMetric {
  icon: string;
  label: string;
  value: string;
  helper: string;
}

interface TeamChartPoint {
  label: string;
  value: number;
}

interface TeamActivity {
  title: string;
  detail: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly metrics: TeamMetric[] = [
    {
      icon: 'feather-message-circle',
      label: 'Open Requests',
      value: '48',
      helper: 'Learner and instructor support items',
    },
    {
      icon: 'feather-check-circle',
      label: 'Resolved Today',
      value: '31',
      helper: 'Completed operational follow-ups',
    },
    {
      icon: 'feather-calendar',
      label: 'Scheduled Sessions',
      value: '12',
      helper: 'Upcoming course and workshop sessions',
    },
    {
      icon: 'feather-activity',
      label: 'SLA Health',
      value: '96%',
      helper: 'Requests handled within target time',
    },
  ];

  readonly weeklyActivity: TeamChartPoint[] = [
    { label: 'Mon', value: 42 },
    { label: 'Tue', value: 54 },
    { label: 'Wed', value: 47 },
    { label: 'Thu', value: 63 },
    { label: 'Fri', value: 58 },
    { label: 'Sat', value: 36 },
  ];

  readonly workQueues: TeamChartPoint[] = [
    { label: 'Admissions', value: 28 },
    { label: 'Courses', value: 18 },
    { label: 'Workshops', value: 13 },
    { label: 'Payments', value: 9 },
  ];

  readonly recentActivity: TeamActivity[] = [
    {
      title: 'Offline course batch updated',
      detail: 'Schedule reviewed for the upcoming weekend batch.',
      status: 'Ready',
    },
    {
      title: 'Workshop enquiry follow-up',
      detail: 'Learner support team assigned pending callbacks.',
      status: 'In Progress',
    },
    {
      title: 'Seminar attendance report',
      detail: 'Participant list checked and shared for review.',
      status: 'Completed',
    },
  ];

  chartHeight(point: TeamChartPoint): number {
    const max = Math.max(...this.weeklyActivity.map((item) => item.value), 1);

    return Math.max(8, Math.round((point.value / max) * 100));
  }

  chartWidth(point: TeamChartPoint): number {
    const max = Math.max(...this.workQueues.map((item) => item.value), 1);

    return Math.max(4, Math.round((point.value / max) * 100));
  }
}
