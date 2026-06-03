import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyLearningCourse, PaymentService } from '../../services/payment';

@Component({
  selector: 'app-my-courses',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './my-courses.html',
  styleUrl: './my-courses.scss',
})
export class MyCourses implements OnInit {
  private readonly amountFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  });

  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);
  courses: MyLearningCourse[] = [];
  loading = false;
  search = '';
  statusFilter = 'all';

  constructor(
    private readonly paymentService: PaymentService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadMyLearning();
  }

  async loadMyLearning(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getMyLearning());
      this.courses = response.success ? response.data ?? [] : [];
    } catch (error: any) {
      await this.alertHelper.error(
        error?.error?.message || 'Unable to fetch your purchased courses',
        'My Learning',
      );
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  courseImage(course: MyLearningCourse): string {
    return course.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(course: MyLearningCourse): void {
    course.thumbnailUrl = null;
  }

  getDurationLabel(course: MyLearningCourse): string {
    if (!course.duration) {
      return 'N/A';
    }

    const unit = Number(course.durationUnit) === 2 ? 'Month(s)' : 'Week(s)';

    return `${course.duration} ${unit}`;
  }

  getHighlights(course: MyLearningCourse): string[] {
    return (course.courseHighlights ?? []).slice(0, 3);
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

  trackByCourseId(_: number, course: MyLearningCourse): number {
    return course.enrollmentId;
  }

  get filteredCourses(): MyLearningCourse[] {
    const term = this.search.trim().toLowerCase();

    return this.courses.filter((course) => {
      const matchesTerm =
        !term ||
        course.title.toLowerCase().includes(term) ||
        (course.categoryName || '').toLowerCase().includes(term) ||
        (course.instructorName || '').toLowerCase().includes(term);
      const matchesStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'active' && Number(course.status) === 1) ||
        (this.statusFilter === 'inactive' && Number(course.status) !== 1);

      return matchesTerm && matchesStatus;
    });
  }

  get activeCoursesCount(): number {
    return this.courses.filter((course) => Number(course.status) === 1).length;
  }

  get averageProgress(): number {
    if (!this.courses.length) {
      return 0;
    }

    const totalProgress = this.courses.reduce(
      (total, course) => total + Math.min(Math.max(Number(course.progressPercent) || 0, 0), 100),
      0,
    );

    return Math.round(totalProgress / this.courses.length);
  }

}
