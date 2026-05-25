import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpEventType } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, firstValueFrom, Subscription, timeout } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { Course } from '../../services/course';
import {
  CurriculumItemPayload,
  CurriculumQuizPayload,
  CurriculumQuizQuestion,
  CurriculumQuizQuestionPayload,
  CurriculumService,
  SectionPayload,
} from '../../services/curriculum';

const CURRICULUM_ITEM_TYPES = ['Lecture', 'Quiz', 'Practice Test', 'Assignment'] as const;

type CurriculumItemType = (typeof CURRICULUM_ITEM_TYPES)[number];
type PlaceholderItemType = Exclude<CurriculumItemType, 'Lecture' | 'Quiz'>;

type LectureSource = 'youtube' | 'upload' | 'article';
type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'true_false';

interface CourseSummary {
  title: string;
  instructor: string;
  thumbnail: string;
  progress: number;
}

interface CurriculumItem {
  id: number;
  type: CurriculumItemType;
  title: string;
  meta: string;
  icon: string;
  sortOrder: number;
  preview?: boolean;
  contentType?: LectureSource;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  fileUrl?: string;
  duration?: string;
  description?: string;
  passingPercentage?: number | string;
  timeLimit?: number | string;
  allowMultipleAttempts?: boolean;
  maxAttempts?: number | string;
}

interface CurriculumSection {
  id: number;
  title: string;
  objective: string;
  sortOrder: number;
  expanded: boolean;
  items: CurriculumItem[];
}

interface SectionDraft {
  title: string;
  objective: string;
}

interface LectureDraft {
  title: string;
  source: LectureSource;
  youtubeUrl: string;
  youtubeVideoId: string;
  uploadFile: File | null;
  uploadFileName: string;
  uploadFileUrl: string;
  article: string;
  duration: string;
  preview: boolean;
  description: string;
}

interface QuizDraft {
  title: string;
  description: string;
  passingPercentage: number | string;
  timeLimit: number | string;
  allowMultipleAttempts: boolean;
  maxAttempts: number | string;
  preview: boolean;
}

interface QuizQuestionOptionDraft {
  id?: number;
  optionText: string;
  isCorrect: boolean;
}

interface QuizQuestionDraft {
  id?: number;
  curriculumItemId?: number;
  question: string;
  questionType: QuizQuestionType;
  marks: number | string;
  explanation: string;
  options: QuizQuestionOptionDraft[];
  sortOrder?: number;
}

interface SectionValidationErrors {
  title?: string;
}

interface LectureValidationErrors {
  title?: string;
  type?: string;
  duration?: string;
  uploadFile?: string;
  youtubeUrl?: string;
}

interface QuizValidationErrors {
  title?: string;
  passingPercentage?: string;
  timeLimit?: string;
  maxAttempts?: string;
}

interface QuizQuestionValidationErrors {
  question?: string;
  questionType?: string;
  marks?: string;
  options?: string;
  correctAnswer?: string;
}

const PENDING_LECTURE_WARNING = 'Curriculum item changes are not saved.';

@Component({
  selector: 'app-add-course-curriculum',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './add-course-curriculum.html',
  styleUrl: './add-course-curriculum.scss',
})
export class AddCourseCurriculum implements OnDestroy {
  readonly placeholderImage = 'assets/images/course/course-01.png';
  courseData: any;
  sections: CurriculumSection[] = [];
  loading = true;
  saving = false;
  publishing = false;
  isCourseDraft = true;
  courseStatusLabel = 'Draft';
  sectionsLoaded = false;
  loadError = '';
  saveError = '';
  showAddSectionForm = false;
  editingSectionId: number | null = null;
  selectedSectionId: number | null = null;
  selectedItemType: CurriculumItemType | null = null;
  editingItemId: number | null = null;
  skeletonSections = Array.from({ length: 3 });
  skeletonItems = Array.from({ length: 3 });
  private youtubeEmbedUrlCache = new Map<string, SafeResourceUrl>();
  private uploadSubscription?: Subscription;
  private quizPreviewSubscription?: Subscription;

  sectionDraft: SectionDraft = this.createSectionDraft();
  lectureDrafts: Record<number, LectureDraft> = {};
  quizDrafts: Record<number, QuizDraft> = {};
  quizQuestionDrafts: Record<number, QuizQuestionDraft> = {};
  showQuizQuestionForm: Record<number, boolean> = {};
  quizQuestions: Record<number, QuizQuestionDraft[]> = {};
  editingQuizQuestionIds: Record<number, number | null> = {};
  loadingQuizQuestions: Record<number, boolean> = {};
  selectedQuestionPreview: QuizQuestionDraft | null = null;
  selectedLecturePreviewItem: CurriculumItem | null = null;
  selectedQuizPreviewItem: CurriculumItem | null = null;
  quizPreviewQuestions: QuizQuestionDraft[] = [];
  quizPreviewLoading = false;
  quizPreviewError = '';
  sectionValidationErrors: SectionValidationErrors = {};
  lectureValidationErrors: Record<number, LectureValidationErrors> = {};
  quizValidationErrors: Record<number, QuizValidationErrors> = {};
  quizQuestionValidationErrors: Record<number, QuizQuestionValidationErrors> = {};
  selectedVideo: File | null = null;
  uploadProgress = 0;
  isUploading = false;
  uploadedFileUrl = '';
  uploadedFileName = '';
  uploadedFileSize = 0;
  hasUnsavedChanges = false;
  uploadError = '';
  itemTypes: CurriculumItemType[] = [...CURRICULUM_ITEM_TYPES];

  course: CourseSummary = {
    title: '',
    instructor: '',
    thumbnail: this.placeholderImage,
    progress: 0,
  };

  constructor(
    private sanitizer: DomSanitizer,
    private formBuilder: FormBuilder,
    private formValidationService: FormValidationService,
    private el: ElementRef,
    private courseService: Course,
    private curriculumService: CurriculumService,
    private changeDetector: ChangeDetectorRef,
    private alertHelper: AlertHelperService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.courseData = history.state.course;
    console.log('Received course data:', this.courseData);

    if (!this.courseData) {
      console.warn('No course data found in state.');
      this.finishLoading();
      return;
    }

    this.syncCourseSummary();

    setTimeout(() => {
      void this.initializeCourseCurriculum();
    });
  }

  ngOnDestroy(): void {
    this.uploadSubscription?.unsubscribe();
    this.quizPreviewSubscription?.unsubscribe();
  }

  @HostListener('window:beforeunload', ['$event'])
  preventRefreshWithUnsavedLecture(event: BeforeUnloadEvent): void {
    if (!this.hasPendingLectureChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = PENDING_LECTURE_WARNING;
  }

  @HostListener('document:keydown.escape')
  closeQuestionPreviewWithEscape(): void {
    if (this.selectedQuestionPreview) {
      this.closeQuestionPreview();
      return;
    }

    if (this.selectedLecturePreviewItem) {
      this.closeLecturePreview();
      return;
    }

    if (this.selectedQuizPreviewItem) {
      this.closeQuizQuestionsPreview();
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasPendingLectureChanges()) {
      return true;
    }

    return this.alertHelper.confirm(
      PENDING_LECTURE_WARNING,
      'Unsaved Lecture Changes',
      'Leave Anyway',
      'Stay Here',
      'warning',
    );
  }

  get totalSections(): number {
    return this.sections.length;
  }

  get totalLectures(): number {
    return this.sections.reduce(
      (total, section) => total + section.items.filter((item) => item.type === 'Lecture').length,
      0,
    );
  }

  get totalQuizzes(): number {
    return this.sections.reduce(
      (total, section) => total + section.items.filter((item) => item.type === 'Quiz').length,
      0,
    );
  }

  get canEditCurriculum(): boolean {
    return this.isCourseDraft && !this.publishing;
  }

  get totalDuration(): string {
    const duration = this.courseData?.duration ?? this.courseData?.totalDuration;

    if (duration === null || duration === undefined || duration === '') {
      return '0 Hours';
    }

    if (typeof duration === 'number') {
      return `${duration} ${duration === 1 ? 'Hour' : 'Hours'}`;
    }

    const durationText = String(duration).trim();

    if (/^\d+(\.\d+)?$/.test(durationText)) {
      return `${durationText} ${durationText === '1' ? 'Hour' : 'Hours'}`;
    }

    return durationText;
  }

  get courseThumbnail(): string {
    return this.course.thumbnail || this.placeholderImage;
  }

  onCourseThumbnailError(): void {
    this.course = {
      ...this.course,
      thumbnail: this.placeholderImage,
    };
  }

  goBackToCourses(): void {
    void this.router.navigate(['/application/courses/manageCourses/view']);
  }

  private async initializeCourseCurriculum(): Promise<void> {
    await this.loadCourseDetails();
    await this.loadSections();
  }

  private async loadCourseDetails(): Promise<void> {
    if (!this.courseData?.id) {
      return;
    }

    try {
      const response: any = await firstValueFrom(
        this.courseService.getCourseById({ id: this.courseData.id }).pipe(timeout(15000)),
      );

      if (!response.status || !response.data) {
        return;
      }

      this.courseData = {
        ...this.courseData,
        ...response.data,
      };
      this.syncCourseSummary();
    } catch (error) {
      console.error('Error loading course details:', error);
    }
  }

  private syncCourseSummary(): void {
    this.syncCourseStatus();

    this.course = {
      title: this.courseData?.title || this.courseData?.courseTitle || '',
      instructor: this.courseData?.instructor || this.courseData?.instructorName || '',
      thumbnail: this.resolveCourseThumbnail(this.courseData),
      progress: this.courseData?.progress ?? 0,
    };
  }

  private syncCourseStatus(): void {
    const status = this.getCourseStatusValue(this.courseData);
    const isPublished = this.isPublishedStatus(status, this.courseData?.statusLabel);

    this.isCourseDraft = !isPublished;
    this.courseStatusLabel = isPublished ? 'Published' : 'Draft';
  }

  private getCourseStatusValue(courseData: any): unknown {
    if (!courseData) {
      return undefined;
    }

    return courseData.status
      ?? courseData.publishStatus
      ?? courseData.courseStatus;
  }

  private isPublishedStatus(status: unknown, statusLabel?: unknown): boolean {
    if (status === 1 || status === true) {
      return true;
    }

    if (typeof status === 'string') {
      const normalizedStatus = status.trim().toLowerCase();

      if (['1', 'published', 'active'].includes(normalizedStatus)) {
        return true;
      }
    }

    return `${statusLabel || ''}`.trim().toLowerCase() === 'published';
  }

  async publishCourse(): Promise<void> {
    if (!this.courseData?.id || !this.isCourseDraft || this.publishing) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Publish this course?',
      'Publish Course',
      'Publish',
      'Cancel',
    );

    if (!confirmed) {
      return;
    }

    this.publishing = true;
    this.saveError = '';

    try {
      const courseResponse: any = await firstValueFrom(
        this.courseService.getCourseById({ id: this.courseData.id }).pipe(timeout(15000)),
      );

      if (!courseResponse.status || !courseResponse.data) {
        this.saveError = courseResponse.message || 'Unable to load course details.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      const publishPayload = this.createCoursePublishPayload(courseResponse.data);
      const response: any = await firstValueFrom(
        this.courseService.updateCourse(publishPayload).pipe(timeout(20000)),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to publish course.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      this.courseData = {
        ...courseResponse.data,
        status: 1,
        statusLabel: 'Published',
      };
      this.syncCourseStatus();
      this.closeCurriculumEditor();
      await this.alertHelper.success(response.message || 'Course published successfully');
    } catch (error) {
      console.error('Error publishing course:', error);
      this.saveError = 'Unable to publish course.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.publishing = false;
      this.changeDetector.detectChanges();
    }
  }

  async loadSections(): Promise<void> {
    if (!this.courseData?.id) {
      this.sections = [];
      this.sectionsLoaded = false;
      this.finishLoading();
      return;
    }

    this.loading = true;
    this.loadError = '';

    try {
      const expandedStates = new Map(
        this.sections.map((section) => [section.id, section.expanded]),
      );
      const response = await firstValueFrom(
        this.curriculumService.getSections({ courseId: this.courseData.id }),
      );

      if (!response.status) {
        this.sections = [];
        this.sectionsLoaded = false;
        this.loadError = response.message || 'Unable to load curriculum sections.';
        return;
      }

      this.sections = this.updateSectionSortOrders(
        (response.data || []).map((section, index) =>
          this.mapApiSectionToState(section, index, expandedStates),
        ),
      );
      this.sectionsLoaded = true;
    } catch (error) {
      console.error('Error loading curriculum sections:', error);
      this.sections = [];
      this.sectionsLoaded = false;
      this.loadError = 'Unable to load curriculum sections.';
    } finally {
      this.finishLoading();
    }
  }

  private finishLoading(): void {
    setTimeout(() => {
      this.loading = false;
      this.changeDetector.markForCheck();
    });
  }

  private ensureCurriculumEditable(): boolean {
    if (this.canEditCurriculum) {
      return true;
    }

    this.saveError = 'Published courses cannot be edited.';
    return false;
  }

  private closeCurriculumEditor(): void {
    this.showAddSectionForm = false;
    this.editingSectionId = null;
    this.selectedSectionId = null;
    this.selectedItemType = null;
    this.editingItemId = null;
    this.sectionDraft = this.createSectionDraft();
    this.sectionValidationErrors = {};
    this.lectureValidationErrors = {};
    this.quizValidationErrors = {};
    this.quizQuestionValidationErrors = {};
    this.resetUploadState();
    this.hasUnsavedChanges = false;
  }

  toggleSection(section: CurriculumSection): void {
    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id
        ? { ...currentSection, expanded: !currentSection.expanded }
        : currentSection,
    );
  }

  async dropSection(event: CdkDragDrop<CurriculumSection[]>): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reorderedSections = [...this.sections];
    moveItemInArray(reorderedSections, event.previousIndex, event.currentIndex);
    const sortedSections = this.updateSectionSortOrders(reorderedSections);
    this.sections = sortedSections;

    try {
      await this.updateSectionOrder(sortedSections);
    } catch (error) {
      console.error('Error updating section order:', error);
      this.saveError = 'Unable to update section order.';
      await this.loadSections();
    }
  }

  async moveSection(sectionIndex: number, direction: -1 | 1): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const nextIndex = sectionIndex + direction;

    if (nextIndex < 0 || nextIndex >= this.sections.length) {
      return;
    }

    const reorderedSections = [...this.sections];
    moveItemInArray(reorderedSections, sectionIndex, nextIndex);
    const sortedSections = this.updateSectionSortOrders(reorderedSections);
    this.sections = sortedSections;
    this.saveError = '';

    try {
      await this.updateSectionOrder(sortedSections);
    } catch (error) {
      console.error('Error updating section order:', error);
      this.saveError = 'Unable to update section order.';
      await this.loadSections();
    }
  }

  async dropCurriculumItem(
    event: CdkDragDrop<CurriculumItem[]>,
    section: CurriculumSection,
  ): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reorderedItems = [...section.items];
    moveItemInArray(reorderedItems, event.previousIndex, event.currentIndex);
    const sortedItems = this.updateItemSortOrders(reorderedItems);

    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id
        ? { ...currentSection, items: sortedItems }
        : currentSection,
    );

    try {
      await this.updateItemOrder(sortedItems);
    } catch (error) {
      console.error('Error updating curriculum item order:', error);
      this.saveError = 'Unable to update curriculum item order.';
    } finally {
      await this.refreshSectionItems(section.id);
    }
  }

  async moveCurriculumItem(
    section: CurriculumSection,
    itemIndex: number,
    direction: -1 | 1,
  ): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const nextIndex = itemIndex + direction;

    if (nextIndex < 0 || nextIndex >= section.items.length) {
      return;
    }

    const reorderedItems = [...section.items];
    moveItemInArray(reorderedItems, itemIndex, nextIndex);
    const sortedItems = this.updateItemSortOrders(reorderedItems);
    this.updateSectionItems(section.id, sortedItems);
    this.saveError = '';

    try {
      await this.updateItemOrder(sortedItems);
    } catch (error) {
      console.error('Error updating curriculum item order:', error);
      this.saveError = 'Unable to update curriculum item order.';
    } finally {
      await this.refreshSectionItems(section.id);
    }
  }

  async updateSectionOrder(sections: CurriculumSection[]): Promise<void> {
    const payload = sections.map((section) => ({
      id: section.id,
      sortOrder: section.sortOrder,
    }));

    const response = await firstValueFrom(this.curriculumService.updateSectionOrder(payload));

    if (!response.status) {
      throw new Error(response.message || 'Unable to update section order.');
    }
  }

  async updateItemOrder(items: CurriculumItem[]): Promise<void> {
    const payload = items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
    }));

    const response = await firstValueFrom(this.curriculumService.updateItemOrder(payload));

    if (!response.status) {
      throw new Error(response.message || 'Unable to update curriculum item order.');
    }
  }

  openSectionForm(): void {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.showAddSectionForm = true;
    this.editingSectionId = null;
    this.sectionDraft = this.createSectionDraft();
  }

  cancelSection(): void {
    this.showAddSectionForm = false;
    this.editingSectionId = null;
    this.sectionDraft = this.createSectionDraft();
    this.sectionValidationErrors = {};
  }

  startEditSection(section: CurriculumSection): void {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.showAddSectionForm = true;
    this.editingSectionId = section.id;
    this.sectionDraft = {
      title: section.title,
      objective: section.objective,
    };
  }

  async saveSection(): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const sectionForm = this.buildSectionValidationForm();

    this.sectionValidationErrors = this.getSectionValidationErrors(sectionForm);

    if (
      !this.formValidationService.validateForm(
        sectionForm,
        this.getSectionFieldName,
        this.el,
      )
    ) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    const sectionPayload: SectionPayload = {
      courseId: this.courseData.id,
      title: this.sectionDraft.title.trim(),
      objective: this.sectionDraft.objective.trim() || 'Define the learner outcome for this section.',
    };

    try {
      const response = await firstValueFrom(
        this.editingSectionId
          ? this.curriculumService.updateSection({
              id: this.editingSectionId,
              title: sectionPayload.title,
              objective: sectionPayload.objective,
            })
          : this.curriculumService.addSection(sectionPayload),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to save section.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      this.cancelSection();
      await this.loadSections();
      await this.alertHelper.success(response.message || 'Section saved successfully');
    } catch (error) {
      console.error('Error adding curriculum section:', error);
      this.saveError = 'Unable to save section.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
    }
  }

  async updateSection(sectionId: number, data: SectionPayload): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(
        this.curriculumService.updateSection({
          id: sectionId,
          ...data,
        }),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to update section.';
        return;
      }

      await this.loadSections();
    } catch (error) {
      console.error('Error updating curriculum section:', error);
      this.saveError = 'Unable to update section.';
    } finally {
      this.saving = false;
    }
  }

  async deleteSection(sectionId: number): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Delete this section and its curriculum items?',
      'Delete Section',
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    if (this.selectedSectionId === sectionId) {
      this.selectedSectionId = null;
      this.selectedItemType = null;
      this.editingItemId = null;
    }

    if (this.editingSectionId === sectionId) {
      this.cancelSection();
    }

    try {
      const response = await firstValueFrom(
        this.curriculumService.deleteSection({ id: sectionId }),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to delete section.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      await this.loadSections();
      await this.alertHelper.success(response.message || 'Section deleted successfully');
    } catch (error) {
      console.error('Error deleting curriculum section:', error);
      this.saveError = 'Unable to delete section.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
    }
  }

  startAddItem(section: CurriculumSection): void {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id ? { ...currentSection, expanded: true } : currentSection,
    );
    this.resetUploadState();
    this.selectedSectionId = section.id;
    this.selectedItemType = null;
    this.editingItemId = null;
  }

  cancelAddItem(section: CurriculumSection): void {
    this.selectedSectionId = null;
    this.selectedItemType = null;
    this.editingItemId = null;
    this.lectureDrafts[section.id] = this.createLectureDraft();
    this.quizDrafts[section.id] = this.createQuizDraft();
    this.quizQuestionDrafts[section.id] = this.createQuizQuestionDraft();
    this.showQuizQuestionForm[section.id] = false;
    this.editingQuizQuestionIds[section.id] = null;
    this.loadingQuizQuestions[section.id] = false;
    this.resetUploadState();
    this.hasUnsavedChanges = false;
    this.clearLectureValidationErrors(section.id);
    this.clearQuizValidationErrors(section.id);
    this.clearQuizQuestionValidationErrors(section.id);
  }

  async startEditItem(section: CurriculumSection, item: CurriculumItem): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id ? { ...currentSection, expanded: true } : currentSection,
    );
    this.selectedSectionId = section.id;
    this.selectedItemType = item.type;
    this.editingItemId = item.id;
    this.resetUploadState();

    if (item.type === 'Quiz') {
      this.quizDrafts = {
        ...this.quizDrafts,
        [section.id]: this.createQuizDraftFromItem(item),
      };
      await this.loadQuizQuestions(section.id, item.id);
    } else {
      const draft = this.createLectureDraftFromItem(item);
      this.lectureDrafts = {
        ...this.lectureDrafts,
        [section.id]: draft,
      };
      this.syncUploadStateFromDraft(draft);
    }

    this.hasUnsavedChanges = false;
    this.clearLectureValidationErrors(section.id);
    this.clearQuizValidationErrors(section.id);
    this.clearQuizQuestionValidationErrors(section.id);
    this.showQuizQuestionForm[section.id] = false;
    this.editingQuizQuestionIds[section.id] = null;
  }

  selectItemType(section: CurriculumSection, type: CurriculumItemType): void {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.selectedSectionId = section.id;
    this.selectedItemType = type;
    this.editingItemId = null;

    if (!this.lectureDrafts[section.id]) {
      this.lectureDrafts[section.id] = this.createLectureDraft();
    }

    if (!this.quizDrafts[section.id]) {
      this.quizDrafts[section.id] = this.createQuizDraft();
    }

    if (!this.quizQuestionDrafts[section.id]) {
      this.quizQuestionDrafts[section.id] = this.createQuizQuestionDraft();
    }

    if (type !== 'Lecture') {
      this.resetUploadState();
      this.hasUnsavedChanges = type === 'Quiz';
      this.showQuizQuestionForm[section.id] = false;
      this.editingQuizQuestionIds[section.id] = null;
      this.quizQuestions[section.id] = [];
      this.loadingQuizQuestions[section.id] = false;
      return;
    }

    this.showQuizQuestionForm[section.id] = false;
    this.editingQuizQuestionIds[section.id] = null;
    this.loadingQuizQuestions[section.id] = false;

    this.markLectureUnsaved();
  }

  isPlaceholderItemType(type: CurriculumItemType | null): type is PlaceholderItemType {
    return type !== null && type !== 'Lecture' && type !== 'Quiz' && this.isAllowedItemType(type);
  }

  getLectureDraft(sectionId: number): LectureDraft {
    if (!this.lectureDrafts[sectionId]) {
      this.lectureDrafts[sectionId] = this.createLectureDraft();
    }

    return this.lectureDrafts[sectionId];
  }

  updateLectureDraft<K extends keyof LectureDraft>(
    sectionId: number,
    field: K,
    value: LectureDraft[K],
  ): void {
    this.lectureDrafts = {
      ...this.lectureDrafts,
      [sectionId]: {
        ...this.getLectureDraft(sectionId),
        [field]: value,
      },
    };

    this.markLectureUnsaved();

    if (field === 'title') {
      this.clearLectureValidationError(sectionId, 'title');
    }

    if (field === 'duration') {
      this.clearLectureValidationError(sectionId, 'duration');
    }
  }

  setLectureSource(sectionId: number, source: LectureSource): void {
    const draft = this.getLectureDraft(sectionId);

    if (draft.source === source) {
      return;
    }

    this.lectureDrafts = {
      ...this.lectureDrafts,
      [sectionId]: {
        ...draft,
        source,
      },
    };

    if (source === 'upload') {
      this.syncUploadStateFromDraft(this.getLectureDraft(sectionId));
      this.clearLectureValidationError(sectionId, 'uploadFile');
    }

    this.markLectureUnsaved();
  }

  setYoutubeUrl(sectionId: number, youtubeUrl: string): void {
    const youtubeVideoId = this.extractYoutubeId(youtubeUrl);

    this.lectureDrafts = {
      ...this.lectureDrafts,
      [sectionId]: {
        ...this.getLectureDraft(sectionId),
        youtubeUrl,
        youtubeVideoId,
      },
    };

    this.markLectureUnsaved();
    this.clearLectureValidationError(sectionId, 'youtubeUrl');
  }

  extractYoutubeId(url: string): string {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return '';
    }

    try {
      const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
      const parsedUrl = new URL(normalizedUrl);

      if (parsedUrl.hostname.includes('youtube.com')) {
        return parsedUrl.searchParams.get('v') || '';
      }

      if (parsedUrl.hostname.includes('youtu.be')) {
        return parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
      }
    } catch {
      return '';
    }

    return '';
  }

  getYoutubeEmbedUrl(sectionId: number): SafeResourceUrl | null {
    const youtubeVideoId = this.getLectureDraft(sectionId).youtubeVideoId;

    if (!youtubeVideoId) {
      return null;
    }

    if (!this.youtubeEmbedUrlCache.has(youtubeVideoId)) {
      this.youtubeEmbedUrlCache.set(
        youtubeVideoId,
        this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${youtubeVideoId}`,
        ),
      );
    }

    return this.youtubeEmbedUrlCache.get(youtubeVideoId) || null;
  }

  setLecturePreview(sectionId: number, preview: boolean): void {
    this.lectureDrafts = {
      ...this.lectureDrafts,
      [sectionId]: {
        ...this.getLectureDraft(sectionId),
        preview,
      },
    };

    this.markLectureUnsaved();
  }

  getQuizDraft(sectionId: number): QuizDraft {
    if (!this.quizDrafts[sectionId]) {
      this.quizDrafts[sectionId] = this.createQuizDraft();
    }

    return this.quizDrafts[sectionId];
  }

  updateQuizDraft<K extends keyof QuizDraft>(
    sectionId: number,
    field: K,
    value: QuizDraft[K],
  ): void {
    this.quizDrafts = {
      ...this.quizDrafts,
      [sectionId]: {
        ...this.getQuizDraft(sectionId),
        [field]: value,
      },
    };

    this.markLectureUnsaved();

    if (
      field === 'title'
      || field === 'passingPercentage'
      || field === 'timeLimit'
      || field === 'maxAttempts'
    ) {
      this.clearQuizValidationError(sectionId, field);
    }
  }

  setQuizAllowMultipleAttempts(sectionId: number, allowMultipleAttempts: boolean): void {
    this.quizDrafts = {
      ...this.quizDrafts,
      [sectionId]: {
        ...this.getQuizDraft(sectionId),
        allowMultipleAttempts,
        maxAttempts: allowMultipleAttempts ? this.getQuizDraft(sectionId).maxAttempts : '',
      },
    };

    this.markLectureUnsaved();
    this.clearQuizValidationError(sectionId, 'maxAttempts');
  }

  setQuizPreview(sectionId: number, preview: boolean): void {
    this.updateQuizDraft(sectionId, 'preview', preview);
  }

  getQuizQuestionDraft(sectionId: number): QuizQuestionDraft {
    if (!this.quizQuestionDrafts[sectionId]) {
      this.quizQuestionDrafts[sectionId] = this.createQuizQuestionDraft();
    }

    return this.quizQuestionDrafts[sectionId];
  }

  getQuizQuestions(sectionId: number): QuizQuestionDraft[] {
    return this.quizQuestions[sectionId] || [];
  }

  canManageQuizQuestions(): boolean {
    return this.selectedItemType === 'Quiz' && this.editingItemId !== null;
  }

  isLoadingQuizQuestions(sectionId: number): boolean {
    return this.loadingQuizQuestions[sectionId] === true;
  }

  getQuizQuestionOptionLabel(index: number): string {
    return `Option ${String.fromCharCode(65 + index)}`;
  }

  getQuizQuestionTypeLabel(questionType: QuizQuestionType): string {
    const labels: Record<QuizQuestionType, string> = {
      single_choice: 'Single Choice',
      multiple_choice: 'Multiple Choice',
      true_false: 'True/False',
    };

    return labels[questionType];
  }

  getCorrectOptionSummary(question: QuizQuestionDraft): string {
    const correctOptions = question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.optionText);

    return correctOptions.length ? correctOptions.join(', ') : 'Not selected';
  }

  isTrueFalseQuestion(sectionId: number): boolean {
    return this.getQuizQuestionDraft(sectionId).questionType === 'true_false';
  }

  isMultipleChoiceQuestion(sectionId: number): boolean {
    return this.getQuizQuestionDraft(sectionId).questionType === 'multiple_choice';
  }

  canAddQuizQuestionOption(sectionId: number): boolean {
    const draft = this.getQuizQuestionDraft(sectionId);

    return draft.questionType !== 'true_false' && draft.options.length < 10;
  }

  canRemoveQuizQuestionOption(sectionId: number): boolean {
    const draft = this.getQuizQuestionDraft(sectionId);

    return draft.questionType !== 'true_false' && draft.options.length > 2;
  }

  async openQuizQuestionForm(sectionId: number): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (!this.canManageQuizQuestions()) {
      await this.alertHelper.error('Please save the quiz before adding questions.');
      return;
    }

    this.showQuizQuestionForm = {
      ...this.showQuizQuestionForm,
      [sectionId]: true,
    };

    this.quizQuestionDrafts[sectionId] = this.createQuizQuestionDraft();
    this.editingQuizQuestionIds[sectionId] = null;

    this.clearQuizQuestionValidationErrors(sectionId);
    this.markLectureUnsaved();
  }

  cancelQuizQuestion(sectionId: number): void {
    this.showQuizQuestionForm = {
      ...this.showQuizQuestionForm,
      [sectionId]: false,
    };
    this.quizQuestionDrafts[sectionId] = this.createQuizQuestionDraft();
    this.editingQuizQuestionIds[sectionId] = null;
    this.clearQuizQuestionValidationErrors(sectionId);
  }

  editQuizQuestion(sectionId: number, question: QuizQuestionDraft): void {
    if (!question.id) {
      return;
    }

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: this.createQuizQuestionDraftFromQuestion(question),
    };
    this.editingQuizQuestionIds = {
      ...this.editingQuizQuestionIds,
      [sectionId]: question.id,
    };
    this.showQuizQuestionForm = {
      ...this.showQuizQuestionForm,
      [sectionId]: true,
    };
    this.clearQuizQuestionValidationErrors(sectionId);
  }

  updateQuizQuestionDraft<K extends keyof QuizQuestionDraft>(
    sectionId: number,
    field: K,
    value: QuizQuestionDraft[K],
  ): void {
    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...this.getQuizQuestionDraft(sectionId),
        [field]: value,
      },
    };

    this.markLectureUnsaved();

    if (field === 'question' || field === 'questionType' || field === 'marks') {
      this.clearQuizQuestionValidationError(sectionId, field);
    }
  }

  setQuizQuestionType(sectionId: number, questionType: QuizQuestionType): void {
    const draft = this.getQuizQuestionDraft(sectionId);

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...draft,
        questionType,
        options: this.createQuestionOptionsForType(questionType, draft.options),
      },
    };

    this.clearQuizQuestionValidationError(sectionId, 'questionType');
    this.clearQuizQuestionValidationError(sectionId, 'options');
    this.clearQuizQuestionValidationError(sectionId, 'correctAnswer');
    this.markLectureUnsaved();
  }

  addQuizQuestionOption(sectionId: number): void {
    if (!this.canAddQuizQuestionOption(sectionId)) {
      return;
    }

    const draft = this.getQuizQuestionDraft(sectionId);

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...draft,
        options: [
          ...draft.options,
          {
            optionText: '',
            isCorrect: false,
          },
        ],
      },
    };

    this.clearQuizQuestionValidationError(sectionId, 'options');
    this.markLectureUnsaved();
  }

  removeQuizQuestionOption(sectionId: number, optionIndex: number): void {
    if (!this.canRemoveQuizQuestionOption(sectionId)) {
      return;
    }

    const draft = this.getQuizQuestionDraft(sectionId);

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...draft,
        options: draft.options.filter((_, index) => index !== optionIndex),
      },
    };

    this.clearQuizQuestionValidationError(sectionId, 'options');
    this.clearQuizQuestionValidationError(sectionId, 'correctAnswer');
    this.markLectureUnsaved();
  }

  updateQuizQuestionOption(sectionId: number, optionIndex: number, optionText: string): void {
    const draft = this.getQuizQuestionDraft(sectionId);

    if (!draft.options[optionIndex] || draft.questionType === 'true_false') {
      return;
    }

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...draft,
        options: draft.options.map((option, index) =>
          index === optionIndex ? { ...option, optionText } : option,
        ),
      },
    };

    this.clearQuizQuestionValidationError(sectionId, 'options');
    this.markLectureUnsaved();
  }

  setQuizQuestionCorrectOption(
    sectionId: number,
    optionIndex: number,
    isCorrect: boolean,
  ): void {
    const draft = this.getQuizQuestionDraft(sectionId);

    if (!draft.options[optionIndex]) {
      return;
    }

    const options = draft.questionType === 'multiple_choice'
      ? draft.options.map((option, index) =>
          index === optionIndex ? { ...option, isCorrect } : option,
        )
      : draft.options.map((option, index) => ({
          ...option,
          isCorrect: index === optionIndex,
        }));

    this.quizQuestionDrafts = {
      ...this.quizQuestionDrafts,
      [sectionId]: {
        ...draft,
        options,
      },
    };

    this.clearQuizQuestionValidationError(sectionId, 'correctAnswer');
    this.markLectureUnsaved();
  }

  openQuestionPreview(question: QuizQuestionDraft): void {
    this.selectedQuestionPreview = this.createQuizQuestionDraftFromQuestion(question);
  }

  closeQuestionPreview(): void {
    this.selectedQuestionPreview = null;
  }

  openLecturePreview(item: CurriculumItem): void {
    if (item.type !== 'Lecture') {
      return;
    }

    this.selectedLecturePreviewItem = item;
  }

  closeLecturePreview(): void {
    this.selectedLecturePreviewItem = null;
  }

  getLecturePreviewSourceLabel(item: CurriculumItem): string {
    return this.getContentTypeLabel(item.contentType || 'article');
  }

  getLecturePreviewDurationLabel(item: CurriculumItem): string {
    return item.duration ? `${item.duration}` : 'No duration';
  }

  getLecturePreviewEmbedUrl(item: CurriculumItem): SafeResourceUrl | null {
    const youtubeVideoId = item.youtubeVideoId || this.extractYoutubeId(item.youtubeUrl || '');

    if (!youtubeVideoId) {
      return null;
    }

    if (!this.youtubeEmbedUrlCache.has(youtubeVideoId)) {
      this.youtubeEmbedUrlCache.set(
        youtubeVideoId,
        this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${youtubeVideoId}`,
        ),
      );
    }

    return this.youtubeEmbedUrlCache.get(youtubeVideoId) || null;
  }

  getLecturePreviewFileUrl(item: CurriculumItem): string {
    const fileUrl = `${item.fileUrl || ''}`.trim();

    if (!fileUrl) {
      return '';
    }

    if (/^(https?:)?\/\//i.test(fileUrl) || fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) {
      return fileUrl;
    }

    return this.curriculumService.buildPrivateFileUrl(fileUrl);
  }

  openQuizQuestionsPreview(item: CurriculumItem): void {
    if (item.type !== 'Quiz') {
      return;
    }

    this.quizPreviewSubscription?.unsubscribe();
    this.selectedQuizPreviewItem = item;
    this.quizPreviewQuestions = [];
    this.quizPreviewError = '';
    this.quizPreviewLoading = true;
    this.changeDetector.detectChanges();

    const previewItemId = item.id;

    this.quizPreviewSubscription = this.curriculumService
      .getQuizQuestions(previewItemId)
      .pipe(
        timeout(10000),
        finalize(() => {
          if (this.selectedQuizPreviewItem?.id === previewItemId) {
            this.quizPreviewLoading = false;
            this.changeDetector.detectChanges();
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (this.selectedQuizPreviewItem?.id !== previewItemId) {
            return;
          }

          if (!response.status) {
            this.quizPreviewError = response.message || 'Unable to load quiz questions.';
            return;
          }

          this.quizPreviewQuestions = this.normalizeQuizQuestionResponse(response.data)
            .map((question) => this.mapApiQuizQuestionToDraft(question));
        },
        error: (error) => {
          if (this.selectedQuizPreviewItem?.id !== previewItemId) {
            return;
          }

          console.error('Error loading quiz preview questions:', error);
          this.quizPreviewError = 'Unable to load quiz questions.';
        },
      });
  }

  closeQuizQuestionsPreview(): void {
    this.quizPreviewSubscription?.unsubscribe();
    this.selectedQuizPreviewItem = null;
    this.quizPreviewQuestions = [];
    this.quizPreviewLoading = false;
    this.quizPreviewError = '';
  }

  async saveQuizQuestion(sectionId: number): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (!this.editingItemId) {
      await this.alertHelper.error('Please save the quiz before adding questions.');
      return;
    }

    const questionForm = this.buildQuizQuestionValidationForm(sectionId);

    this.quizQuestionValidationErrors = {
      ...this.quizQuestionValidationErrors,
      [sectionId]: this.getQuizQuestionValidationErrors(questionForm),
    };

    const optionErrors = this.getQuizQuestionOptionValidationErrors(
      this.getQuizQuestionDraft(sectionId),
    );

    this.quizQuestionValidationErrors = {
      ...this.quizQuestionValidationErrors,
      [sectionId]: {
        ...this.quizQuestionValidationErrors[sectionId],
        ...optionErrors,
      },
    };

    if (
      !this.formValidationService.validateForm(
        questionForm,
        this.getQuizQuestionFieldName,
        this.el,
      )
      || optionErrors.options
      || optionErrors.correctAnswer
    ) {
      return;
    }

    const draft = this.getQuizQuestionDraft(sectionId);
    const questionPayload = this.createQuizQuestionPayload(this.editingItemId, draft);
    const editingQuestionId = this.editingQuizQuestionIds[sectionId];

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(
        editingQuestionId
          ? this.curriculumService.updateQuizQuestion(editingQuestionId, questionPayload)
          : this.curriculumService.addQuizQuestion(questionPayload),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to save question.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      this.cancelQuizQuestion(sectionId);
      await this.loadQuizQuestions(sectionId, this.editingItemId);
      await this.alertHelper.success(response.message || 'Question saved successfully');
    } catch (error) {
      console.error('Error saving quiz question:', error);
      this.saveError = 'Unable to save question.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async deleteQuizQuestion(sectionId: number, questionId: number): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (!this.editingItemId) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      'Delete this quiz question?',
      'Delete Quiz Question',
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(
        this.curriculumService.deleteQuizQuestion(questionId),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to delete question.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      if (this.editingQuizQuestionIds[sectionId] === questionId) {
        this.cancelQuizQuestion(sectionId);
      }

      await this.loadQuizQuestions(sectionId, this.editingItemId);
      await this.alertHelper.success(response.message || 'Question deleted successfully');
    } catch (error) {
      console.error('Error deleting quiz question:', error);
      this.saveError = 'Unable to delete question.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  setUploadVideo(sectionId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      void this.alertHelper.error('Please select an MP4, MOV, or WebM video.', 'Invalid Video');
      input.value = '';
      return;
    }

    this.uploadSubscription?.unsubscribe();
    this.selectedVideo = file;
    this.uploadProgress = 0;
    this.isUploading = true;
    this.uploadedFileUrl = '';
    this.uploadedFileName = file.name;
    this.uploadedFileSize = file.size;
    this.uploadError = '';
    this.markLectureUnsaved();

    this.lectureDrafts = {
      ...this.lectureDrafts,
      [sectionId]: {
        ...this.getLectureDraft(sectionId),
        uploadFile: file,
        uploadFileName: file.name,
        uploadFileUrl: '',
      },
    };

    this.clearLectureValidationError(sectionId, 'uploadFile');
    this.uploadSubscription = this.curriculumService.uploadItemVideo(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total || file.size;
          this.uploadProgress = total
            ? Math.min(100, Math.round((event.loaded / total) * 100))
            : this.uploadProgress;
          this.changeDetector.detectChanges();
          return;
        }

        if (event.type === HttpEventType.Response) {
          const response = event.body;
          this.isUploading = false;

          if (!response?.status || !response.data?.fileUrl) {
            this.markVideoUploadFailed(response?.message || 'Unable to upload video.');
            return;
          }

          this.uploadProgress = 100;
          this.uploadedFileUrl = response.data.fileUrl;
          this.uploadedFileName = response.data.originalName || file.name;
          this.uploadedFileSize = file.size;
          this.uploadError = '';
          this.lectureDrafts = {
            ...this.lectureDrafts,
            [sectionId]: {
              ...this.getLectureDraft(sectionId),
              uploadFile: file,
              uploadFileName: this.uploadedFileName,
              uploadFileUrl: this.uploadedFileUrl,
            },
          };
          this.clearLectureValidationError(sectionId, 'uploadFile');
          this.changeDetector.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error uploading curriculum video:', error);
        this.markVideoUploadFailed('Unable to upload video.');
      },
    });

    input.value = '';
  }

  async saveLecture(section: CurriculumSection): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const draft = this.getLectureDraft(section.id);
    const lectureForm = this.buildLectureValidationForm(section.id);

    this.lectureValidationErrors = {
      ...this.lectureValidationErrors,
      [section.id]: this.getLectureValidationErrors(lectureForm),
    };

    if (
      !this.formValidationService.validateForm(
        lectureForm,
        this.getLectureFieldName,
        this.el,
      )
    ) {
      return;
    }

    const confirmed = await this.alertHelper.confirm(
      `${this.editingItemId ? 'Update' : 'Save'} "${draft.title.trim()}" in this section?`,
      this.editingItemId ? 'Update Lecture' : 'Save Lecture',
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      if (draft.source === 'upload' && this.isUploading) {
        this.saveError = 'Please wait for the video upload to complete.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      if (draft.source === 'upload' && !draft.uploadFileUrl) {
        this.saveError = 'Please upload a video before saving this lecture.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      const itemPayload: CurriculumItemPayload = {
        sectionId: section.id,
        type: 'Lecture',
        title: draft.title.trim(),
        contentType: draft.source,
        youtubeUrl: draft.source === 'youtube' ? draft.youtubeUrl.trim() : '',
        youtubeVideoId: draft.source === 'youtube' ? draft.youtubeVideoId : '',
        fileUrl: draft.source === 'upload' ? draft.uploadFileUrl : '',
        duration: draft.source === 'article' ? '' : draft.duration.trim(),
        description: draft.source === 'article' ? draft.article.trim() : draft.description.trim(),
        isPreview: draft.preview,
        sortOrder: section.items.length + 1,
      };

      const response = await firstValueFrom(
        this.editingItemId
          ? this.curriculumService.updateItem(this.editingItemId, itemPayload)
          : this.curriculumService.addItem(itemPayload),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to add curriculum item.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      if (response.data && !this.editingItemId) {
        const createdItem = this.mapApiItemToState(response.data, section.items.length);

        if (createdItem) {
          this.appendSectionItem(section.id, createdItem);
        }
      }

      this.cancelAddItem(section);
      this.hasUnsavedChanges = false;
      await this.refreshSectionItems(section.id);
      await this.alertHelper.success(response.message || 'Curriculum item saved successfully');
    } catch (error) {
      console.error('Error adding curriculum item:', error);
      this.saveError = 'Unable to add curriculum item.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async saveQuiz(section: CurriculumSection): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const draft = this.getQuizDraft(section.id);
    const quizForm = this.buildQuizValidationForm(section.id);

    this.quizValidationErrors = {
      ...this.quizValidationErrors,
      [section.id]: this.getQuizValidationErrors(quizForm),
    };

    if (
      !this.formValidationService.validateForm(
        quizForm,
        this.getQuizFieldName,
        this.el,
      )
    ) {
      return;
    }

    const title = draft.title.trim();
    const confirmed = await this.alertHelper.confirm(
      `${this.editingItemId ? 'Update' : 'Save'} "${title}" in this section?`,
      this.editingItemId ? 'Update Quiz' : 'Save Quiz',
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const quizPayload = this.createQuizPayloadFromDraft(section.id, draft);
      const response = await firstValueFrom(
        this.editingItemId
          ? this.curriculumService.updateQuiz(this.editingItemId, quizPayload)
          : this.curriculumService.addQuiz(quizPayload),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to save quiz.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      this.cancelAddItem(section);
      this.hasUnsavedChanges = false;
      await this.refreshSectionItems(section.id);
      await this.alertHelper.success(response.message || 'Quiz saved successfully');
    } catch (error) {
      console.error('Error saving quiz:', error);
      this.saveError = 'Unable to save quiz.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async savePlaceholderItem(section: CurriculumSection): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    if (!this.isPlaceholderItemType(this.selectedItemType)) {
      return;
    }

    const selectedItemType = this.selectedItemType;
    const editingItem = this.editingItemId
      ? section.items.find((item) => item.id === this.editingItemId)
      : null;
    const itemPayload: CurriculumItemPayload = {
      sectionId: section.id,
      title: editingItem?.title || `New ${selectedItemType}`,
      type: selectedItemType,
      contentType: selectedItemType,
      youtubeUrl: '',
      youtubeVideoId: '',
      fileUrl: '',
      duration: '',
      description: '',
      isPreview: false,
      sortOrder: section.items.length + 1,
    };

    const confirmed = await this.alertHelper.confirm(
      `${this.editingItemId ? 'Update' : 'Save'} "${itemPayload.title}" in this section?`,
      this.editingItemId ? `Update ${selectedItemType}` : `Save ${selectedItemType}`,
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(
        this.editingItemId
          ? this.curriculumService.updateItem(this.editingItemId, itemPayload)
          : this.curriculumService.addItem(itemPayload),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to add curriculum item.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      if (response.data && !this.editingItemId) {
        const createdItem = this.mapApiItemToState(response.data, section.items.length);

        if (createdItem) {
          this.appendSectionItem(section.id, createdItem);
        }
      }

      this.cancelAddItem(section);
      await this.refreshSectionItems(section.id);
      await this.alertHelper.success(response.message || 'Curriculum item saved successfully');
    } catch (error) {
      console.error('Error adding curriculum item:', error);
      this.saveError = 'Unable to add curriculum item.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  async updateCurriculumItem(
    sectionId: number,
    itemId: number,
    data: CurriculumItemPayload,
  ): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(this.curriculumService.updateItem(itemId, data));

      if (!response.status) {
        this.saveError = response.message || 'Unable to update curriculum item.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      await this.refreshSectionItems(sectionId);
      await this.alertHelper.success(response.message || 'Curriculum item updated successfully');
    } catch (error) {
      console.error('Error updating curriculum item:', error);
      this.saveError = 'Unable to update curriculum item.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
    }
  }

  async deleteCurriculumItem(sectionId: number, itemId: number): Promise<void> {
    if (!this.ensureCurriculumEditable()) {
      return;
    }

    const item = this.sections
      .find((section) => section.id === sectionId)
      ?.items.find((currentItem) => currentItem.id === itemId);
    const confirmed = await this.alertHelper.confirm(
      'Delete this curriculum item?',
      'Delete Curriculum Item',
    );

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      const response = await firstValueFrom(
        item?.type === 'Quiz'
          ? this.curriculumService.deleteQuiz(itemId)
          : this.curriculumService.deleteItem(itemId),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to delete curriculum item.';
        await this.alertHelper.error(this.saveError);
        return;
      }

      if (this.editingItemId === itemId) {
        this.selectedSectionId = null;
        this.selectedItemType = null;
        this.editingItemId = null;
      }

      this.removeSectionItem(sectionId, itemId);
      await this.refreshSectionItems(sectionId);
      await this.alertHelper.success(response.message || 'Curriculum item deleted successfully');
    } catch (error) {
      console.error('Error deleting curriculum item:', error);
      this.saveError = 'Unable to delete curriculum item.';
      await this.alertHelper.error(this.saveError);
    } finally {
      this.saving = false;
    }
  }

  getQuizPassingLabel(item: CurriculumItem): string {
    const passingPercentage = this.toOptionalNumber(item.passingPercentage);

    return `${passingPercentage ?? 0}%`;
  }

  getQuizTimeLabel(item: CurriculumItem): string {
    const timeLimit = this.toOptionalNumber(item.timeLimit);

    return `${timeLimit ?? 0} min`;
  }

  getQuizAttemptLabel(item: CurriculumItem): string {
    if (!this.toBoolean(item.allowMultipleAttempts)) {
      return 'Single attempt';
    }

    const maxAttempts = this.toOptionalNumber(item.maxAttempts);

    return `${maxAttempts ?? 0} attempts`;
  }

  formatFileSize(size: number): string {
    if (!size) {
      return 'Size unavailable';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let normalizedSize = size;
    let unitIndex = 0;

    while (normalizedSize >= 1024 && unitIndex < units.length - 1) {
      normalizedSize /= 1024;
      unitIndex += 1;
    }

    const precision = normalizedSize >= 10 || unitIndex === 0 ? 0 : 1;

    return `${normalizedSize.toFixed(precision)} ${units[unitIndex]}`;
  }

  private hasPendingLectureChanges(): boolean {
    return this.isUploading || this.hasUnsavedChanges;
  }

  private markLectureUnsaved(): void {
    this.hasUnsavedChanges = true;
  }

  private resetUploadState(): void {
    this.uploadSubscription?.unsubscribe();
    this.uploadSubscription = undefined;
    this.selectedVideo = null;
    this.uploadProgress = 0;
    this.isUploading = false;
    this.uploadedFileUrl = '';
    this.uploadedFileName = '';
    this.uploadedFileSize = 0;
    this.uploadError = '';
  }

  private syncUploadStateFromDraft(draft: LectureDraft): void {
    if (draft.source !== 'upload' || !draft.uploadFileUrl) {
      return;
    }

    this.uploadProgress = 100;
    this.uploadedFileUrl = draft.uploadFileUrl;
    this.uploadedFileName = draft.uploadFileName || 'Selected video';
    this.uploadedFileSize = draft.uploadFile?.size || 0;
    this.uploadError = '';
  }

  private markVideoUploadFailed(message: string): void {
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadedFileUrl = '';
    this.uploadError = message;
    this.changeDetector.detectChanges();
  }

  private resolveCourseThumbnail(courseData: any): string {
    const thumbnail = [
      courseData.thumbnailUrl,
      courseData.courseThumbnailUrl,
      courseData.imageUrl,
      courseData.thumbnail,
      courseData.courseThumbnail,
      courseData.image,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);

    return this.toDisplayImageUrl(thumbnail) || this.placeholderImage;
  }

  private toDisplayImageUrl(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    const imageUrl = value.trim();

    if (!imageUrl) {
      return '';
    }

    if (/^(https?:)?\/\//i.test(imageUrl) || /^(data|blob):/i.test(imageUrl)) {
      return imageUrl;
    }

    if (imageUrl.startsWith('assets/') || imageUrl.startsWith('/assets/')) {
      return imageUrl;
    }

    if (imageUrl.startsWith('course-thumbnails/')) {
      return `${environment.apiUrl}/getAfile?path=${encodeURIComponent(imageUrl)}`;
    }

    return imageUrl;
  }

  private createSectionDraft(): SectionDraft {
    return {
      title: '',
      objective: '',
    };
  }

  private createLectureDraft(): LectureDraft {
    return {
      title: '',
      source: 'youtube',
      youtubeUrl: '',
      youtubeVideoId: '',
      uploadFile: null,
      uploadFileName: '',
      uploadFileUrl: '',
      article: '',
      duration: '',
      preview: false,
      description: '',
    };
  }

  private createLectureDraftFromItem(item: CurriculumItem): LectureDraft {
    const source = item.contentType || 'youtube';

    return {
      title: item.title,
      source,
      youtubeUrl: item.youtubeUrl || '',
      youtubeVideoId: item.youtubeVideoId || '',
      uploadFile: null,
      uploadFileName: item.fileUrl ? 'Selected video' : '',
      uploadFileUrl: item.fileUrl || '',
      article: source === 'article' ? item.description || '' : '',
      duration: item.duration || '',
      preview: Boolean(item.preview),
      description: item.description || '',
    };
  }

  private createQuizDraft(): QuizDraft {
    return {
      title: '',
      description: '',
      passingPercentage: 70,
      timeLimit: 30,
      allowMultipleAttempts: false,
      maxAttempts: '',
      preview: false,
    };
  }

  private createQuizQuestionDraft(): QuizQuestionDraft {
    return {
      question: '',
      questionType: 'single_choice',
      marks: 1,
      explanation: '',
      options: this.createQuestionOptionsForType('single_choice'),
    };
  }

  private createQuizQuestionDraftFromQuestion(question: QuizQuestionDraft): QuizQuestionDraft {
    return {
      id: question.id,
      curriculumItemId: question.curriculumItemId,
      question: question.question,
      questionType: question.questionType,
      marks: question.marks,
      explanation: question.explanation,
      sortOrder: question.sortOrder,
      options: question.options.map((option) => ({ ...option })),
    };
  }

  private createQuizQuestionPayload(
    curriculumItemId: number,
    draft: QuizQuestionDraft,
  ): CurriculumQuizQuestionPayload {
    return {
      curriculumItemId,
      question: draft.question.trim(),
      questionType: draft.questionType,
      marks: Number(draft.marks),
      explanation: draft.explanation.trim(),
      options: draft.options.map((option) => ({
        optionText: option.optionText.trim(),
        isCorrect: option.isCorrect,
      })),
    };
  }

  private mapApiQuizQuestionToDraft(question: CurriculumQuizQuestion): QuizQuestionDraft {
    return {
      id: question.id,
      curriculumItemId: question.curriculumItemId,
      question: question.question || '',
      questionType: question.questionType,
      marks: question.marks ?? 1,
      explanation: question.explanation || '',
      sortOrder: question.sortOrder,
      options: (question.options || []).map((option) => ({
        id: option.id,
        optionText: option.optionText || '',
        isCorrect: this.toBoolean(option.isCorrect),
      })),
    };
  }

  private createQuestionOptionsForType(
    questionType: QuizQuestionType,
    currentOptions: QuizQuestionOptionDraft[] = [],
  ): QuizQuestionOptionDraft[] {
    if (questionType === 'true_false') {
      return [
        {
          optionText: 'True',
          isCorrect: currentOptions.some((option) =>
            option.optionText.toLowerCase() === 'true' && option.isCorrect,
          ),
        },
        {
          optionText: 'False',
          isCorrect: currentOptions.some((option) =>
            option.optionText.toLowerCase() === 'false' && option.isCorrect,
          ),
        },
      ];
    }

    const options = currentOptions.length >= 2
      ? currentOptions.map((option) => ({ ...option }))
      : Array.from({ length: 4 }, () => ({
          optionText: '',
          isCorrect: false,
        }));

    const normalizedOptions = options.slice(0, 10);

    while (normalizedOptions.length < 4) {
      normalizedOptions.push({
        optionText: '',
        isCorrect: false,
      });
    }

    if (questionType === 'single_choice') {
      let hasCorrectOption = false;

      return normalizedOptions.map((option) => {
        if (!option.isCorrect || hasCorrectOption) {
          return {
            ...option,
            isCorrect: false,
          };
        }

        hasCorrectOption = true;

        return option;
      });
    }

    return normalizedOptions;
  }

  private createQuizDraftFromItem(item: CurriculumItem): QuizDraft {
    return {
      title: item.title || '',
      description: item.description || '',
      passingPercentage: item.passingPercentage ?? 70,
      timeLimit: item.timeLimit ?? item.duration ?? 30,
      allowMultipleAttempts: this.toBoolean(item.allowMultipleAttempts),
      maxAttempts: item.maxAttempts ?? '',
      preview: Boolean(item.preview),
    };
  }

  private createQuizPayloadFromDraft(
    sectionId: number,
    draft: QuizDraft,
  ): CurriculumQuizPayload {
    return {
      sectionId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      passingPercentage: Number(draft.passingPercentage),
      timeLimit: Number(draft.timeLimit),
      allowMultipleAttempts: draft.allowMultipleAttempts,
      maxAttempts: draft.allowMultipleAttempts ? Number(draft.maxAttempts) : null,
      isPreview: draft.preview,
    };
  }

  private getQuizMeta(draft: QuizDraft): string {
    const attempts = draft.allowMultipleAttempts
      ? `${draft.maxAttempts || 0} attempts`
      : 'Single attempt';

    return `Pass ${draft.passingPercentage}% \u2022 ${draft.timeLimit} min \u2022 ${attempts}`;
  }

  private async loadQuizQuestions(sectionId: number, curriculumItemId: number): Promise<void> {
    this.loadingQuizQuestions = {
      ...this.loadingQuizQuestions,
      [sectionId]: true,
    };
    this.quizQuestions = {
      ...this.quizQuestions,
      [sectionId]: [],
    };
    this.changeDetector.detectChanges();

    try {
      const response = await firstValueFrom(
        this.curriculumService.getQuizQuestions(curriculumItemId).pipe(timeout(10000)),
      );

      if (!response.status) {
        this.saveError = response.message || 'Unable to load quiz questions.';
        return;
      }

      this.quizQuestions = {
        ...this.quizQuestions,
        [sectionId]: this.normalizeQuizQuestionResponse(response.data)
          .map((question) => this.mapApiQuizQuestionToDraft(question)),
      };
    } catch (error) {
      console.error('Error loading quiz questions:', error);
      this.saveError = 'Unable to load quiz questions.';
      this.quizQuestions = {
        ...this.quizQuestions,
        [sectionId]: [],
      };
    } finally {
      this.loadingQuizQuestions = {
        ...this.loadingQuizQuestions,
        [sectionId]: false,
      };
      this.changeDetector.detectChanges();
    }
  }

  private async refreshSectionItems(sectionId: number): Promise<void> {
    try {
      const response = await firstValueFrom(this.curriculumService.getItems(sectionId));

      if (!response.status) {
        this.saveError = response.message || 'Unable to load curriculum items.';
        return;
      }

      this.updateSectionItems(
        sectionId,
        this.updateItemSortOrders(
          (response.data || [])
            .map((item, index) => this.mapApiItemToState(item, index))
            .filter((item: CurriculumItem | null): item is CurriculumItem => item !== null),
        ),
      );
    } catch (error) {
      console.error('Error loading curriculum items:', error);
      this.saveError = 'Unable to load curriculum items.';
    }
  }

  private appendSectionItem(sectionId: number, item: CurriculumItem): void {
    this.sections = this.sections.map((section) =>
      section.id === sectionId
        ? { ...section, items: this.updateItemSortOrders([...section.items, item]) }
        : section,
    );
    this.changeDetector.detectChanges();
  }

  private removeSectionItem(sectionId: number, itemId: number): void {
    this.sections = this.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            items: this.updateItemSortOrders(section.items.filter((item) => item.id !== itemId)),
          }
        : section,
    );
    this.changeDetector.detectChanges();
  }

  private updateSectionItems(sectionId: number, items: CurriculumItem[]): void {
    this.sections = this.sections.map((section) =>
      section.id === sectionId ? { ...section, items } : section,
    );
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const numericValue = Number(value);

    return Number.isNaN(numericValue) ? undefined : numericValue;
  }

  private createCoursePublishPayload(course: any): FormData {
    const formData = new FormData();
    const title = String(course.title || this.course.title || '').trim();
    const description = String(course.description || this.courseData?.description || '').trim();
    const categoryId = course.categoryId ?? course.category ?? this.courseData?.categoryId ?? '';
    const duration = this.toOptionalNumber(course.duration ?? this.courseData?.duration) ?? 1;
    const durationUnit = this.toOptionalNumber(
      course.durationUnit ?? this.courseData?.durationUnit,
    ) ?? 1;
    const price = this.toOptionalNumber(course.price ?? this.courseData?.price) ?? 0;
    const oldPrice = course.oldPrice ?? this.courseData?.oldPrice;
    const highlights = this.normalizeCourseHighlightsForPublish(
      course.courseHighlights ?? this.courseData?.courseHighlights,
    );

    formData.append('id', `${course.id || this.courseData?.id}`);
    formData.append('title', title);
    formData.append('category', `${categoryId}`);
    formData.append('instructor', JSON.stringify(this.getCourseInstructorIds(course)));
    formData.append('duration', `${duration}`);
    formData.append('durationUnit', `${durationUnit}`);
    formData.append('price', `${price}`);
    formData.append('description', description);
    formData.append('courseHighlights', JSON.stringify(highlights));
    formData.append('status', '1');

    if (oldPrice !== null && oldPrice !== undefined && oldPrice !== '') {
      formData.append('oldPrice', `${oldPrice}`);
    }

    return formData;
  }

  private getCourseInstructorIds(course: any): number[] {
    const instructors = course.instructors ?? this.courseData?.instructors;

    if (Array.isArray(instructors)) {
      return instructors
        .map((instructor) =>
          typeof instructor === 'object' ? Number(instructor.id) : Number(instructor),
        )
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    const instructorIds = course.instructorIds ?? this.courseData?.instructorIds;

    if (Array.isArray(instructorIds)) {
      return instructorIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    if (typeof instructorIds === 'string') {
      try {
        const parsed = JSON.parse(instructorIds);
        return Array.isArray(parsed)
          ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
          : [];
      } catch {
        return instructorIds
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isFinite(id) && id > 0);
      }
    }

    return [];
  }

  private normalizeCourseHighlightsForPublish(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
          ? parsed.map((item) => String(item).trim()).filter((item) => item.length > 0)
          : [];
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    }

    return [];
  }

  private normalizeQuizQuestionResponse(data: unknown): CurriculumQuizQuestion[] {
    if (Array.isArray(data)) {
      return data as CurriculumQuizQuestion[];
    }

    if (data && typeof data === 'object') {
      return Object.values(data as Record<string, CurriculumQuizQuestion>);
    }

    return [];
  }

  private mapApiSectionToState(
    section: any,
    index: number,
    expandedStates?: Map<number, boolean>,
  ): CurriculumSection {
    const sectionId = Number(section.id);

    return {
      id: sectionId,
      title: section.title || '',
      objective: section.objective || '',
      sortOrder: Number(section.sortOrder ?? section.sort_order ?? index + 1),
      expanded: expandedStates?.get(sectionId) ?? Boolean(section.expanded),
      items: this.updateItemSortOrders(
        (section.items || [])
          .map((item: any, itemIndex: number) => this.mapApiItemToState(item, itemIndex))
          .filter((item: CurriculumItem | null): item is CurriculumItem => item !== null),
      ),
    };
  }

  private mapApiItemToState(item: any, index: number): CurriculumItem | null {
    const itemType = this.normalizeApiItemType(item.type);

    if (!itemType) {
      return null;
    }

    const contentType = this.normalizeApiContentType(item.contentType || item.content_type);
    const duration = item.duration ? ` \u2022 ${item.duration}` : '';
    const passingPercentage = this.toOptionalNumber(
      item.passingPercentage ?? item.passing_percentage,
    );
    const timeLimit = this.toOptionalNumber(item.timeLimit ?? item.time_limit);
    const allowMultipleAttempts = this.toBoolean(
      item.allowMultipleAttempts ?? item.allow_multiple_attempts,
    );
    const maxAttempts = this.toOptionalNumber(item.maxAttempts ?? item.max_attempts);
    const preview = this.toBoolean(item.isPreview ?? item.is_preview);
    const quizDraft: QuizDraft = {
      title: item.title || '',
      description: item.description || '',
      passingPercentage: passingPercentage ?? 70,
      timeLimit: timeLimit ?? 30,
      allowMultipleAttempts,
      maxAttempts: maxAttempts ?? '',
      preview,
    };

    return {
      id: Number(item.id),
      type: itemType,
      title: item.title || '',
      meta: itemType === 'Quiz'
        ? this.getQuizMeta(quizDraft)
        : `${this.getContentTypeLabel(contentType)}${duration}`,
      icon: this.getItemIcon(itemType),
      sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1),
      preview,
      contentType: itemType === 'Quiz' ? undefined : contentType,
      youtubeUrl: item.youtubeUrl || item.youtube_url || '',
      youtubeVideoId: item.youtubeVideoId || item.youtube_video_id || '',
      fileUrl: item.fileUrl || item.file_url || '',
      duration: item.duration || '',
      description: item.description || '',
      passingPercentage,
      timeLimit,
      allowMultipleAttempts,
      maxAttempts,
    };
  }

  private normalizeApiItemType(type: string): CurriculumItemType | null {
    const normalizedType = String(type || 'lecture').toLowerCase().replace(/_/g, ' ');
    const itemTypes: Record<string, CurriculumItemType> = {
      lecture: 'Lecture',
      quiz: 'Quiz',
      'practice test': 'Practice Test',
      assignment: 'Assignment',
    };

    return itemTypes[normalizedType] || null;
  }

  private isAllowedItemType(type: unknown): type is CurriculumItemType {
    return (
      typeof type === 'string'
      && (CURRICULUM_ITEM_TYPES as readonly string[]).includes(type)
    );
  }

  private normalizeApiContentType(contentType: string): LectureSource {
    const normalizedType = String(contentType || 'article').toLowerCase();

    if (normalizedType === 'youtube' || normalizedType === 'upload' || normalizedType === 'article') {
      return normalizedType;
    }

    return 'article';
  }

  private buildSectionValidationForm(): FormGroup {
    return this.formBuilder.group({
      sectionTitle: [this.sectionDraft.title, Validators.required],
    });
  }

  private buildLectureValidationForm(sectionId: number): FormGroup {
    const draft = this.getLectureDraft(sectionId);

    return this.formBuilder.group({
      lectureTitle: [draft.title, Validators.required],
      lectureType: [this.selectedItemType, Validators.required],
      lectureDuration: [draft.duration, draft.source !== 'article' ? Validators.required : []],
      uploadFile: [draft.uploadFileUrl, draft.source === 'upload' ? Validators.required : []],
      youtubeUrl: [
        draft.youtubeUrl,
        draft.source === 'youtube'
          ? [Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]+/)]
          : [],
      ],
    });
  }

  private buildQuizValidationForm(sectionId: number): FormGroup {
    const draft = this.getQuizDraft(sectionId);

    return this.formBuilder.group({
      quizTitle: [draft.title, Validators.required],
      quizPassingPercentage: [
        draft.passingPercentage,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      quizTimeLimit: [draft.timeLimit, [Validators.required, Validators.min(1)]],
      quizMaxAttempts: [
        draft.maxAttempts,
        draft.allowMultipleAttempts
          ? [Validators.required, Validators.min(2)]
          : [],
      ],
    });
  }

  private buildQuizQuestionValidationForm(sectionId: number): FormGroup {
    const draft = this.getQuizQuestionDraft(sectionId);

    return this.formBuilder.group({
      question: [draft.question, Validators.required],
      questionType: [draft.questionType, Validators.required],
      marks: [draft.marks, [Validators.required, Validators.min(1)]],
    });
  }

  private getSectionValidationErrors(form: FormGroup): SectionValidationErrors {
    return {
      title: this.getControlErrorMessage(form, 'sectionTitle', this.getSectionFieldName),
    };
  }

  private getLectureValidationErrors(form: FormGroup): LectureValidationErrors {
    return {
      title: this.getControlErrorMessage(form, 'lectureTitle', this.getLectureFieldName),
      type: this.getControlErrorMessage(form, 'lectureType', this.getLectureFieldName),
      duration: this.getControlErrorMessage(form, 'lectureDuration', this.getLectureFieldName),
      uploadFile: this.getControlErrorMessage(form, 'uploadFile', this.getLectureFieldName),
      youtubeUrl: this.getControlErrorMessage(form, 'youtubeUrl', this.getLectureFieldName),
    };
  }

  private getQuizValidationErrors(form: FormGroup): QuizValidationErrors {
    return {
      title: this.getControlErrorMessage(form, 'quizTitle', this.getQuizFieldName),
      passingPercentage: this.getControlErrorMessage(
        form,
        'quizPassingPercentage',
        this.getQuizFieldName,
      ),
      timeLimit: this.getControlErrorMessage(form, 'quizTimeLimit', this.getQuizFieldName),
      maxAttempts: this.getControlErrorMessage(form, 'quizMaxAttempts', this.getQuizFieldName),
    };
  }

  private getQuizQuestionValidationErrors(form: FormGroup): QuizQuestionValidationErrors {
    return {
      question: this.getControlErrorMessage(form, 'question', this.getQuizQuestionFieldName),
      questionType: this.getControlErrorMessage(
        form,
        'questionType',
        this.getQuizQuestionFieldName,
      ),
      marks: this.getControlErrorMessage(form, 'marks', this.getQuizQuestionFieldName),
    };
  }

  private getQuizQuestionOptionValidationErrors(
    draft: QuizQuestionDraft,
  ): QuizQuestionValidationErrors {
    const optionCount = draft.options.length;

    if (optionCount < 2) {
      return {
        options: 'Minimum 2 options are required',
      };
    }

    if (optionCount > 10) {
      return {
        options: 'Maximum 10 options are allowed',
      };
    }

    if (draft.options.some((option) => !option.optionText.trim())) {
      return {
        options: 'All options are required',
      };
    }

    const correctAnswerCount = draft.options.filter((option) => option.isCorrect).length;

    if (correctAnswerCount === 0) {
      return {
        correctAnswer: 'Select the correct answer',
      };
    }

    if (draft.questionType !== 'multiple_choice' && correctAnswerCount !== 1) {
      return {
        correctAnswer: 'Select one correct answer',
      };
    }

    return {};
  }

  private getControlErrorMessage(
    form: FormGroup,
    controlName: string,
    getFieldName: (fieldName: string) => string,
  ): string {
    const control = form.get(controlName);

    if (!control?.errors) {
      return '';
    }

    const fieldName = getFieldName(controlName);

    if (control.errors['required']) {
      return `${fieldName} is required`;
    }

    if (control.errors['pattern']) {
      return `${fieldName} format is invalid`;
    }

    if (control.errors['min'] || control.errors['max']) {
      return `${fieldName} is out of range`;
    }

    return `${fieldName} is invalid`;
  }

  private clearLectureValidationError(
    sectionId: number,
    field: keyof LectureValidationErrors,
  ): void {
    this.lectureValidationErrors = {
      ...this.lectureValidationErrors,
      [sectionId]: {
        ...this.lectureValidationErrors[sectionId],
        [field]: '',
      },
    };
  }

  private clearLectureValidationErrors(sectionId: number): void {
    const { [sectionId]: _removedErrors, ...remainingErrors } = this.lectureValidationErrors;
    this.lectureValidationErrors = remainingErrors;
  }

  private clearQuizValidationError(sectionId: number, field: keyof QuizValidationErrors): void {
    this.quizValidationErrors = {
      ...this.quizValidationErrors,
      [sectionId]: {
        ...this.quizValidationErrors[sectionId],
        [field]: '',
      },
    };
  }

  private clearQuizValidationErrors(sectionId: number): void {
    const { [sectionId]: _removedErrors, ...remainingErrors } = this.quizValidationErrors;
    this.quizValidationErrors = remainingErrors;
  }

  private clearQuizQuestionValidationError(
    sectionId: number,
    field: keyof QuizQuestionValidationErrors,
  ): void {
    this.quizQuestionValidationErrors = {
      ...this.quizQuestionValidationErrors,
      [sectionId]: {
        ...this.quizQuestionValidationErrors[sectionId],
        [field]: '',
      },
    };
  }

  private clearQuizQuestionValidationErrors(sectionId: number): void {
    const { [sectionId]: _removedErrors, ...remainingErrors } = this.quizQuestionValidationErrors;
    this.quizQuestionValidationErrors = remainingErrors;
  }

  getSectionFieldName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      sectionTitle: 'Section title',
    };

    return fieldNames[fieldName] || fieldName;
  };

  getLectureFieldName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      lectureTitle: 'Lecture title',
      lectureType: 'Lecture type',
      lectureDuration: 'Duration',
      uploadFile: 'Video file',
      youtubeUrl: 'YouTube URL',
    };

    return fieldNames[fieldName] || fieldName;
  };

  getQuizFieldName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      quizTitle: 'Quiz title',
      quizPassingPercentage: 'Passing percentage',
      quizTimeLimit: 'Time limit',
      quizMaxAttempts: 'Max attempts',
    };

    return fieldNames[fieldName] || fieldName;
  };

  getQuizQuestionFieldName = (fieldName: string): string => {
    const fieldNames: Record<string, string> = {
      question: 'Question',
      questionType: 'Question type',
      marks: 'Marks',
    };

    return fieldNames[fieldName] || fieldName;
  };

  private updateSectionSortOrders(sections: CurriculumSection[]): CurriculumSection[] {
    return sections.map((section, index) => ({
      ...section,
      sortOrder: index + 1,
    }));
  }

  private updateItemSortOrders(items: CurriculumItem[]): CurriculumItem[] {
    return items.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
  }

  private getSourceLabel(source: LectureSource): string {
    const sourceLabels: Record<LectureSource, string> = {
      youtube: 'YouTube',
      upload: 'Video',
      article: 'Article',
    };

    return sourceLabels[source];
  }

  private getContentTypeLabel(contentType: LectureSource): string {
    return this.getSourceLabel(contentType);
  }

  getItemIcon(type: CurriculumItemType): string {
    const icons: Record<CurriculumItemType, string> = {
      Lecture: 'fa-solid fa-video',
      Quiz: 'fa-solid fa-circle-question',
      'Practice Test': 'fa-solid fa-list-check',
      Assignment: 'fa-solid fa-clipboard-check',
    };

    return icons[type] || 'fa-solid fa-file-lines';
  }
}
