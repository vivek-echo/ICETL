import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyLearningCourse, PaymentService } from '../../services/payment';
import { CertificateService } from '../../services/certificate.service';
import { NgxSpinnerService } from 'ngx-spinner';
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
    private readonly certificateService: CertificateService,
    private readonly spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    void this.loadMyLearning();
  }

  certificateLoading: boolean = false;
  certificateLoadingCourseId: number | null = null;

  canDownloadCourseCertificate(course: any): boolean {
    const progress = Number(course?.progressPercent || 0);
    // return progress >= 75;
    return true;
  }

  isCertificateGenerating(courseId: number): boolean {
    return this.certificateLoadingCourseId === courseId;
  }

  async downloadCourseCertificate(courseId: number, courseType: any): Promise<void> {
    if (!courseId || this.certificateLoading) {
      return;
    }

    const moduleType = courseType == 1 ? 'COURSE' : 'ACADEMIC_COURSE';

    const payload = {
      moduleType: moduleType,
      moduleId: courseId,
    };

    this.spinner.show();
    this.certificateLoading = true;
    this.certificateLoadingCourseId = courseId;

    try {
      const res: any = await lastValueFrom(this.certificateService.generateCertificate(payload));

      const downloadUrl = res?.downloadUrl || res?.data?.downloadUrl;

      if (!downloadUrl) {
        // Swal.fire('Error', 'Certificate generated, but download link not found.', 'error');
        return;
      }

      /**
       * Fetch PDF as Blob and force download
       */
      const fileResponse: any = await lastValueFrom(
        this.certificateService.downloadCertificateFile(downloadUrl),
      );

      const blob = fileResponse.body;

      if (!blob) {
        // Swal.fire('Error', 'Certificate file not found.', 'error');
        return;
      }

      const fileName =
        moduleType === 'COURSE'
          ? `course-certificate-${courseId}.pdf`
          : `academic-course-certificate-${courseId}.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';

      document.body.appendChild(anchor);
      anchor.click();

      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      const message =
        error?.error?.message || error?.error?.msg || 'Unable to generate certificate.';

      // Swal.fire('Error', message, 'error');
    } finally {
      this.certificateLoading = false;
      this.certificateLoadingCourseId = null;
      this.spinner.hide();
      this.cdr.detectChanges();
    }
  }

  async loadMyLearning(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.paymentService.getMyLearning());
      this.courses = response.success ? (response.data ?? []) : [];
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

  isAcademicCourse(course: MyLearningCourse): boolean {
    return Number(course.courseType) === 2;
  }

  hasYoutubeLink(course: MyLearningCourse): boolean {
    return this.normalizeExternalUrl(course.youtubeLiveUrl).length > 0;
  }

  hasMeetingLink(course: MyLearningCourse): boolean {
    return this.normalizeExternalUrl(course.meetingLink).length > 0;
  }

  getYoutubeUrl(course: MyLearningCourse): string {
    return this.normalizeExternalUrl(course.youtubeLiveUrl);
  }

  getMeetingUrl(course: MyLearningCourse): string {
    return this.normalizeExternalUrl(course.meetingLink);
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

  private normalizeExternalUrl(value: string | null | undefined): string {
    const url = `${value ?? ''}`.trim();

    if (!url) {
      return '';
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
}
