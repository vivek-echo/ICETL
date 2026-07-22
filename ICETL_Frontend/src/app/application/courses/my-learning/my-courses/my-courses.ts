import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { MyLearningCourse, PaymentService } from '../../services/payment';
import { CertificateHistoryItem, CertificateService } from '../../services/certificate.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ModuleMaterialsModalComponent } from '../../shared/module-materials-modal/module-materials-modal';
@Component({
  selector: 'app-my-courses',
  imports: [CommonModule, RouterLink, FormsModule, ModuleMaterialsModalComponent],
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
  showFilters = false;
  search = '';
  statusFilter = 'all';
  selectedMaterialsCourse: MyLearningCourse | null = null;

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

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
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
    const course = this.courses.find((item) => Number(item.id) === Number(courseId));

    const payload = {
      moduleType: moduleType,
      moduleId: courseId,
    };

    this.spinner.show();
    this.certificateLoading = true;
    this.certificateLoadingCourseId = courseId;

    try {
      let downloadUrl = course?.certificateDownloadUrl || '';
      let certificateNo = course?.certificateNo || '';

      if (!downloadUrl) {
        const res: any = await lastValueFrom(this.certificateService.generateCertificate(payload));
        downloadUrl = res?.downloadUrl || res?.data?.downloadUrl;
        certificateNo = res?.certificateNo || res?.data?.certificateNo || certificateNo;
      }

      if (!downloadUrl) {
        await this.alertHelper.error(
          'Certificate was prepared, but the download link was not returned.',
          'Certificate',
        );
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
        await this.alertHelper.error('Certificate file could not be downloaded.', 'Certificate');
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

      if (course) {
        course.certificateNo = certificateNo || course.certificateNo;
        course.certificateDownloadUrl = downloadUrl;
        course.certificateStatus = 'active';
      }
    } catch (error: any) {
      const message =
        error?.error?.message || error?.error?.msg || 'Unable to generate certificate.';

      await this.alertHelper.error(message, 'Certificate');
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
      await this.applyCertificateHistory();
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

  getCourseActionLabel(course: MyLearningCourse): string {
    const progress = Number(course.progressPercent) || 0;

    if (progress >= 100) {
      return 'View Course';
    }

    return progress > 0 ? 'Continue Learning' : 'Start Learning';
  }

  getProgressLabel(course: MyLearningCourse): string {
    const progress = Number(course.progressPercent) || 0;

    if (progress >= 100) {
      return 'Completed';
    }

    return progress > 0 ? 'In progress' : 'Not started';
  }

  getResumeLabel(course: MyLearningCourse): string {
    if (course.lastWatchedAt) {
      return `Last accessed ${this.formatDate(course.lastWatchedAt)}`;
    }

    const progress = Number(course.progressPercent) || 0;

    if (progress > 0) {
      return 'Resume from your saved progress';
    }

    return this.isAcademicCourse(course) ? 'Open session links and materials' : 'Begin the first available lesson';
  }

  getCertificateStatusLabel(course: MyLearningCourse): string {
    if (course.certificateNo) {
      return course.certificateIssueDate
        ? `Issued ${this.formatDate(course.certificateIssueDate)}`
        : `Issued ${course.certificateNo}`;
    }

    return this.canDownloadCourseCertificate(course)
      ? 'Certificate download available'
      : 'Certificate unlocks after the required progress';
  }

  openMaterials(course: MyLearningCourse): void {
    this.selectedMaterialsCourse = course;
  }

  closeMaterials(): void {
    this.selectedMaterialsCourse = null;
  }

  getYoutubeUrl(course: MyLearningCourse): string {
    return this.normalizeExternalUrl(course.youtubeLiveUrl);
  }

  getMeetingUrl(course: MyLearningCourse): string {
    return this.normalizeExternalUrl(course.meetingLink);
  }

  getCourseLocationLabel(course: MyLearningCourse): string {
    return (
      course.locationLabel ||
      [course.branchName, course.districtName, course.stateName].filter(Boolean).join(', ') ||
      [course.venue, course.city].filter(Boolean).join(', ') ||
      'N/A'
    );
  }

  getCourseAddress(course: MyLearningCourse): string {
    return `${course.branchAddress || ''}`.trim();
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
        (course.instructorName || '').toLowerCase().includes(term) ||
        (course.locationLabel || '').toLowerCase().includes(term) ||
        (course.branchName || '').toLowerCase().includes(term) ||
        (course.branchAddress || '').toLowerCase().includes(term) ||
        (course.districtName || '').toLowerCase().includes(term) ||
        (course.stateName || '').toLowerCase().includes(term);
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

  get latestEnrollmentLabel(): string {
    return this.courses.length ? this.formatDate(this.courses[0].enrolledAt) : 'N/A';
  }

  private async applyCertificateHistory(): Promise<void> {
    if (!this.courses.length) {
      return;
    }

    try {
      const response = await lastValueFrom(this.certificateService.getCertificateHistory());
      const certificates = response.data?.items ?? [];

      this.courses = this.courses.map((course) => {
        const certificate = this.findCourseCertificate(course, certificates);

        if (!certificate) {
          return course;
        }

        return {
          ...course,
          certificateNo: certificate.certificateNo,
          certificateDownloadUrl: certificate.downloadUrl,
          certificateStatus: certificate.status,
          certificateIssueDate: certificate.issueDate,
        };
      });
    } catch {
      // Certificate history is supportive only; keep My Learning usable if it fails.
    }
  }

  private findCourseCertificate(
    course: MyLearningCourse,
    certificates: CertificateHistoryItem[],
  ): CertificateHistoryItem | undefined {
    const moduleTypes = Number(course.courseType) === 1
      ? ['COURSE', 'ACADEMIC_COURSE']
      : ['ACADEMIC_COURSE', 'COURSE'];

    return certificates.find((certificate) =>
      Number(certificate.moduleId) === Number(course.id) &&
      moduleTypes.includes(`${certificate.moduleType || ''}`.toUpperCase()),
    );
  }

  private normalizeExternalUrl(value: string | null | undefined): string {
    const url = `${value ?? ''}`.trim();

    if (!url) {
      return '';
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
}
