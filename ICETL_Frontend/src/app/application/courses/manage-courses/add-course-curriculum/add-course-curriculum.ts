import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpEventType } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { CurriculumItemPayload, CurriculumService, SectionPayload } from '../../services/curriculum';

type CurriculumItemType =
  | 'Lecture'
  | 'Quiz'
  | 'Coding Exercise'
  | 'Practice Test'
  | 'Assignment'
  | 'Role Play';

type LectureSource = 'youtube' | 'upload' | 'article';

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

const PENDING_LECTURE_WARNING = 'Video upload or lecture changes are not saved.';

@Component({
  selector: 'app-add-course-curriculum',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './add-course-curriculum.html',
  styleUrl: './add-course-curriculum.scss',
})
export class AddCourseCurriculum implements OnDestroy {
  courseData: any;
  sections: CurriculumSection[] = [];
  loading = true;
  saving = false;
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

  sectionDraft: SectionDraft = this.createSectionDraft();
  lectureDrafts: Record<number, LectureDraft> = {};
  sectionValidationErrors: SectionValidationErrors = {};
  lectureValidationErrors: Record<number, LectureValidationErrors> = {};
  selectedVideo: File | null = null;
  uploadProgress = 0;
  isUploading = false;
  uploadedFileUrl = '';
  uploadedFileName = '';
  uploadedFileSize = 0;
  hasUnsavedChanges = false;
  uploadError = '';
  itemTypes: CurriculumItemType[] = [
    'Lecture',
    'Quiz',
    'Coding Exercise',
    'Practice Test',
    'Assignment',
    'Role Play',
  ];

  course: CourseSummary = {
    title: '',
    instructor: '',
    thumbnail: '',
    progress: 0,
  };

  constructor(
    private sanitizer: DomSanitizer,
    private formBuilder: FormBuilder,
    private formValidationService: FormValidationService,
    private el: ElementRef,
    private curriculumService: CurriculumService,
    private changeDetector: ChangeDetectorRef,
    private alertHelper: AlertHelperService,
  ) {}

  ngOnInit() {
    this.courseData = history.state.course;
    console.log('Received course data:', this.courseData);

    if (!this.courseData) {
      console.warn('No course data found in state.');
      this.finishLoading();
      return;
    }

    this.course = {
      title: this.courseData.title || this.courseData.courseTitle || '',
      instructor: this.courseData.instructor || this.courseData.instructorName || '',
      thumbnail:
        this.courseData.thumbnail ||
        this.courseData.courseThumbnail ||
        this.courseData.image ||
        '',
      progress: this.courseData.progress ?? 0,
    };

    setTimeout(() => {
      void this.loadSections();
    });
  }

  ngOnDestroy(): void {
    this.uploadSubscription?.unsubscribe();
  }

  @HostListener('window:beforeunload', ['$event'])
  preventRefreshWithUnsavedLecture(event: BeforeUnloadEvent): void {
    if (!this.hasPendingLectureChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = PENDING_LECTURE_WARNING;
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

  get totalDuration(): string {
    return this.courseData?.duration || this.courseData?.totalDuration || '0 Hours';
  }

  saveCurriculum(): void {
    if (this.saving) {
      return;
    }

    this.saving = true;

    setTimeout(() => {
      this.saving = false;
    }, 800);
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
      this.changeDetector.detectChanges();
    });
  }

  toggleSection(section: CurriculumSection): void {
    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id
        ? { ...currentSection, expanded: !currentSection.expanded }
        : currentSection,
    );
  }

  async dropSection(event: CdkDragDrop<CurriculumSection[]>): Promise<void> {
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

  async dropCurriculumItem(
    event: CdkDragDrop<CurriculumItem[]>,
    section: CurriculumSection,
  ): Promise<void> {
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
    this.showAddSectionForm = true;
    this.editingSectionId = section.id;
    this.sectionDraft = {
      title: section.title,
      objective: section.objective,
    };
  }

  async saveSection(): Promise<void> {
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
    this.resetUploadState();
    this.hasUnsavedChanges = false;
    this.clearLectureValidationErrors(section.id);
  }

  startEditItem(section: CurriculumSection, item: CurriculumItem): void {
    this.sections = this.sections.map((currentSection) =>
      currentSection.id === section.id ? { ...currentSection, expanded: true } : currentSection,
    );
    this.selectedSectionId = section.id;
    this.selectedItemType = item.type;
    this.editingItemId = item.id;
    const draft = this.createLectureDraftFromItem(item);
    this.lectureDrafts = {
      ...this.lectureDrafts,
      [section.id]: draft,
    };
    this.resetUploadState();
    this.syncUploadStateFromDraft(draft);
    this.hasUnsavedChanges = false;
    this.clearLectureValidationErrors(section.id);
  }

  selectItemType(section: CurriculumSection, type: CurriculumItemType): void {
    this.selectedSectionId = section.id;
    this.selectedItemType = type;
    this.editingItemId = null;

    if (!this.lectureDrafts[section.id]) {
      this.lectureDrafts[section.id] = this.createLectureDraft();
    }

    if (type !== 'Lecture') {
      this.resetUploadState();
      this.hasUnsavedChanges = false;
      return;
    }

    this.markLectureUnsaved();
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
        this.appendSectionItem(section.id, this.mapApiItemToState(response.data, section.items.length));
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

  async savePlaceholderItem(section: CurriculumSection): Promise<void> {
    if (!this.selectedItemType || this.selectedItemType === 'Lecture') {
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
        this.appendSectionItem(section.id, this.mapApiItemToState(response.data, section.items.length));
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
      const response = await firstValueFrom(this.curriculumService.deleteItem(itemId));

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
          (response.data || []).map((item, index) => this.mapApiItemToState(item, index)),
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
      items: (section.items || []).map((item: any, itemIndex: number) =>
        this.mapApiItemToState(item, itemIndex),
      ),
    };
  }

  private mapApiItemToState(item: any, index: number): CurriculumItem {
    const itemType = this.normalizeApiItemType(item.type);
    const contentType = this.normalizeApiContentType(item.contentType || item.content_type);
    const duration = item.duration ? ` \u2022 ${item.duration}` : '';

    return {
      id: Number(item.id),
      type: itemType,
      title: item.title || '',
      meta: `${this.getContentTypeLabel(contentType)}${duration}`,
      icon: this.getItemIcon(itemType),
      sortOrder: Number(item.sortOrder ?? item.sort_order ?? index + 1),
      preview: Boolean(item.isPreview ?? item.is_preview),
      contentType,
      youtubeUrl: item.youtubeUrl || item.youtube_url || '',
      youtubeVideoId: item.youtubeVideoId || item.youtube_video_id || '',
      fileUrl: item.fileUrl || item.file_url || '',
      duration: item.duration || '',
      description: item.description || '',
    };
  }

  private normalizeApiItemType(type: string): CurriculumItemType {
    const normalizedType = String(type || 'lecture').toLowerCase().replace(/_/g, ' ');
    const itemTypes: Record<string, CurriculumItemType> = {
      lecture: 'Lecture',
      quiz: 'Quiz',
      'coding exercise': 'Coding Exercise',
      'practice test': 'Practice Test',
      assignment: 'Assignment',
      'role play': 'Role Play',
    };

    return itemTypes[normalizedType] || 'Lecture';
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
      'Coding Exercise': 'fa-solid fa-code',
      'Practice Test': 'fa-solid fa-list-check',
      Assignment: 'fa-solid fa-clipboard-check',
      'Role Play': 'fa-solid fa-comments',
    };

    return icons[type] || 'fa-solid fa-file-lines';
  }
}
