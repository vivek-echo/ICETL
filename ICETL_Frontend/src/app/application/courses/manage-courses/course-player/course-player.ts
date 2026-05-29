import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom, timeout } from 'rxjs';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import {
  LearningCoursePayload,
  LearningItem,
  LearningProgress,
  LearningQuizQuestion,
  LearningQuizSubmitResult,
  LearningService,
} from '../../services/learning';

@Component({
  selector: 'app-course-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './course-player.html',
  styleUrl: './course-player.scss',
})
export class CoursePlayer implements OnInit {
  readonly placeholderImage = 'assets/images/course/course-01.png';
  readonly skeletonItems = Array.from({ length: 8 }, (_, index) => index);

  courseId = 0;
  data: LearningCoursePayload | null = null;
  loading = true;
  errorMessage = '';
  selectedItemId: number | null = null;
  noteDrafts: Record<number, string> = {};
  quizAnswers: Record<number, Record<number, number[]>> = {};
  quizResults: Record<number, LearningQuizSubmitResult> = {};
  savingNotes = new Set<number>();
  savingProgress = new Set<number>();
  submittingQuizzes = new Set<number>();
  notesPanelOpen = false;

  private readonly youtubeEmbedUrlCache = new Map<string, SafeResourceUrl>();

  constructor(
    private readonly router: Router,
    private readonly learningService: LearningService,
    private readonly alertHelper: AlertHelperService,
    private readonly sanitizer: DomSanitizer,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const navigationState = this.router.getCurrentNavigation()?.extras.state as
      | { courseId?: number | string }
      | undefined;
    const browserState =
      typeof history !== 'undefined'
        ? (history.state as { courseId?: number | string } | undefined)
        : undefined;

    this.courseId = Number(navigationState?.courseId ?? browserState?.courseId) || 0;

    if (!this.courseId) {
      this.loading = false;
      this.errorMessage = 'Course not found.';
      return;
    }

    void this.loadCourse();
  }

  async loadCourse(preserveSelection = false): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.learningService.getCourse(this.courseId).pipe(timeout(15000)),
      );

      if (!response.success) {
        this.errorMessage = response.message || 'Unable to load this course.';
        return;
      }

      this.data = response.data;
      this.seedDrafts();
      this.selectedItemId = this.resolveSelectedItemId(preserveSelection);

      if (this.activeItem && this.activeItem.progress.status === 'not_started') {
        void this.saveProgressForItem(this.activeItem, 'in_progress', true);
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Unable to load this course.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get allItems(): LearningItem[] {
    return this.data?.sections.flatMap((section) => section.items) ?? [];
  }

  get activeItem(): LearningItem | null {
    return this.allItems.find((item) => item.id === this.selectedItemId) ?? this.allItems[0] ?? null;
  }

  get previousItem(): LearningItem | null {
    const active = this.activeItem;
    const index = active ? this.allItems.findIndex((item) => item.id === active.id) : -1;

    return index > 0 ? this.allItems[index - 1] : null;
  }

  get nextItem(): LearningItem | null {
    const active = this.activeItem;
    const index = active ? this.allItems.findIndex((item) => item.id === active.id) : -1;

    return index >= 0 && index < this.allItems.length - 1 ? this.allItems[index + 1] : null;
  }

  get progressPercent(): number {
    return Math.min(Math.max(Number(this.data?.course.progressPercent) || 0, 0), 100);
  }

  selectItem(item: LearningItem): void {
    this.selectedItemId = item.id;

    if (item.progress.status === 'not_started') {
      void this.saveProgressForItem(item, 'in_progress', true);
    }
  }

  openNotes(): void {
    this.notesPanelOpen = true;
  }

  closeNotes(): void {
    this.notesPanelOpen = false;
  }

  async completeActiveLecture(goNext = false): Promise<void> {
    const item = this.activeItem;

    if (!item || this.isQuiz(item)) {
      return;
    }

    await this.saveProgressForItem(item, 'completed');

    if (goNext && this.nextItem) {
      this.selectItem(this.nextItem);
    }
  }

  async saveNote(item: LearningItem): Promise<void> {
    if (!this.data || this.savingNotes.has(item.id)) {
      return;
    }

    this.savingNotes.add(item.id);
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.learningService
          .saveNote({
            courseId: this.data.course.id,
            curriculumItemId: item.id,
            note: this.noteDrafts[item.id] ?? '',
          })
          .pipe(timeout(12000)),
      );

      if (!response.success) {
        await this.alertHelper.error(response.message || 'Unable to save note.');
        return;
      }

      item.note = response.data;
      this.recalculateSummary();
    } catch (error: any) {
      await this.alertHelper.error(error?.error?.message || 'Unable to save note.');
    } finally {
      this.savingNotes.delete(item.id);
      this.cdr.detectChanges();
    }
  }

  clearNote(item: LearningItem): void {
    this.noteDrafts[item.id] = '';
    void this.saveNote(item);
  }

  setQuizAnswer(
    item: LearningItem,
    question: LearningQuizQuestion,
    optionId: number,
    selected: boolean,
  ): void {
    const answers = this.ensureQuizAnswers(item.id);

    if (question.questionType === 'multiple_choice') {
      const current = new Set(answers[question.id] ?? []);
      selected ? current.add(optionId) : current.delete(optionId);
      answers[question.id] = [...current];
      return;
    }

    answers[question.id] = selected ? [optionId] : [];
  }

  isOptionSelected(item: LearningItem, question: LearningQuizQuestion, optionId: number): boolean {
    return (this.quizAnswers[item.id]?.[question.id] ?? []).includes(optionId);
  }

  canSubmitQuiz(item: LearningItem): boolean {
    if (!item.quiz?.canAttempt || this.submittingQuizzes.has(item.id)) {
      return false;
    }

    return item.quiz.questions.every(
      (question) => (this.quizAnswers[item.id]?.[question.id] ?? []).length > 0,
    );
  }

  async submitQuiz(item: LearningItem): Promise<void> {
    if (!this.data || !item.quiz || !this.canSubmitQuiz(item)) {
      return;
    }

    this.submittingQuizzes.add(item.id);
    this.cdr.detectChanges();

    try {
      const answers = item.quiz.questions.map((question) => ({
        questionId: question.id,
        selectedOptionIds: this.quizAnswers[item.id]?.[question.id] ?? [],
      }));
      const response = await lastValueFrom(
        this.learningService.submitQuiz(this.data.course.id, item.id, answers).pipe(timeout(15000)),
      );

      if (!response.success) {
        await this.alertHelper.error(response.message || 'Unable to submit quiz.');
        return;
      }

      this.quizResults[item.id] = response.data;
      item.progress = response.data.progress;
      item.quiz.latestAttempt = response.data.attempt;
      item.quiz.attemptsUsed += 1;
      item.quiz.canAttempt = !response.data.attempt.passed && this.hasAttemptsRemaining(item);
      this.data.course.progressPercent = response.data.courseProgressPercent;
      this.recalculateSummary();
    } catch (error: any) {
      await this.alertHelper.error(error?.error?.message || 'Unable to submit quiz.');
    } finally {
      this.submittingQuizzes.delete(item.id);
      this.cdr.detectChanges();
    }
  }

  getQuizResult(item: LearningItem): LearningQuizSubmitResult | null {
    return this.quizResults[item.id] ?? null;
  }

  hasQuizResult(item: LearningItem): boolean {
    return Boolean(this.getQuizResult(item));
  }

  getReviewForQuestion(item: LearningItem, questionId: number) {
    return this.getQuizResult(item)?.review.find((review) => review.questionId === questionId) ?? null;
  }

  getQuestionStatusClass(item: LearningItem, questionId: number): string {
    const review = this.getReviewForQuestion(item, questionId);

    if (!review) {
      return '';
    }

    return review.isCorrect ? 'is-correct' : 'is-incorrect';
  }

  getCorrectOptionsText(item: LearningItem, question: LearningQuizQuestion): string {
    const review = this.getReviewForQuestion(item, question.id);

    if (!review) {
      return '';
    }

    return question.options
      .filter((option) => review.correctOptionIds.includes(option.id))
      .map((option) => option.optionText)
      .join(', ');
  }

  isQuiz(item: LearningItem | null): boolean {
    if (!item) {
      return false;
    }

    return String(item.type || '').toLowerCase() === 'quiz' || Boolean(item.quiz);
  }

  isCompleted(item: LearningItem): boolean {
    return item.progress.status === 'completed';
  }

  isSavingProgress(item: LearningItem): boolean {
    return this.savingProgress.has(item.id);
  }

  isSavingNote(item: LearningItem): boolean {
    return this.savingNotes.has(item.id);
  }

  isSubmittingQuiz(item: LearningItem): boolean {
    return this.submittingQuizzes.has(item.id);
  }

  courseImage(): string {
    return this.data?.course.thumbnailUrl || this.placeholderImage;
  }

  onCourseImageError(): void {
    if (this.data) {
      this.data.course.thumbnailUrl = null;
    }
  }

  getYoutubeEmbedUrl(item: LearningItem): SafeResourceUrl | null {
    const videoId = item.youtubeVideoId || this.extractYoutubeId(item.youtubeUrl || '');

    if (!videoId) {
      return null;
    }

    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    const cachedUrl = this.youtubeEmbedUrlCache.get(embedUrl);

    if (cachedUrl) {
      return cachedUrl;
    }

    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    this.youtubeEmbedUrlCache.set(embedUrl, safeUrl);

    return safeUrl;
  }

  getContentTypeLabel(item: LearningItem): string {
    if (this.isQuiz(item)) {
      return 'Quiz';
    }

    const labels: Record<string, string> = {
      youtube: 'YouTube',
      upload: 'Video',
      article: 'Article',
    };

    return labels[String(item.contentType || '').toLowerCase()] || 'Lecture';
  }

  getItemIcon(item: LearningItem): string {
    if (this.isQuiz(item)) {
      return 'fa-solid fa-circle-question';
    }

    if (item.contentType === 'article') {
      return 'fa-solid fa-file-lines';
    }

    return 'fa-solid fa-circle-play';
  }

  getDurationLabel(item: LearningItem): string {
    return item.duration ? item.duration : this.isQuiz(item) ? `${item.timeLimit || 0} min` : 'Self paced';
  }

  getAttemptLabel(item: LearningItem): string {
    if (!item.quiz) {
      return '';
    }

    if (item.quiz.maxAttempts === null) {
      return `${item.quiz.attemptsUsed} attempts`;
    }

    return `${item.quiz.attemptsUsed}/${item.quiz.maxAttempts} attempts`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Not saved yet';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  trackBySectionId(_: number, section: { id: number }): number {
    return section.id;
  }

  trackByItemId(_: number, item: LearningItem): number {
    return item.id;
  }

  trackByQuestionId(_: number, question: LearningQuizQuestion): number {
    return question.id;
  }

  trackByOptionId(_: number, option: { id: number }): number {
    return option.id;
  }

  private async saveProgressForItem(
    item: LearningItem,
    status: 'not_started' | 'in_progress' | 'completed',
    silent = false,
  ): Promise<void> {
    if (!this.data || this.savingProgress.has(item.id)) {
      return;
    }

    this.savingProgress.add(item.id);
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.learningService
          .saveProgress({
            courseId: this.data.course.id,
            curriculumItemId: item.id,
            status,
            progressPercent: status === 'completed' ? 100 : item.progress.progressPercent,
          })
          .pipe(timeout(12000)),
      );

      if (!response.success) {
        if (!silent) {
          await this.alertHelper.error(response.message || 'Unable to save progress.');
        }
        return;
      }

      item.progress = response.data.progress;
      this.data.course.progressPercent = response.data.courseProgressPercent;
      this.recalculateSummary();
    } catch (error: any) {
      if (!silent) {
        await this.alertHelper.error(error?.error?.message || 'Unable to save progress.');
      }
    } finally {
      this.savingProgress.delete(item.id);
      this.cdr.detectChanges();
    }
  }

  private seedDrafts(): void {
    for (const item of this.allItems) {
      if (this.noteDrafts[item.id] === undefined) {
        this.noteDrafts[item.id] = item.note?.note ?? '';
      }

      if (item.quiz && !this.quizAnswers[item.id]) {
        this.quizAnswers[item.id] = {};
      }
    }
  }

  private resolveSelectedItemId(preserveSelection: boolean): number | null {
    if (!this.allItems.length) {
      return null;
    }

    if (preserveSelection && this.selectedItemId) {
      const selectedExists = this.allItems.some((item) => item.id === this.selectedItemId);

      if (selectedExists) {
        return this.selectedItemId;
      }
    }

    return (
      this.allItems.find((item) => item.progress.status !== 'completed')?.id ??
      this.allItems[0].id
    );
  }

  private recalculateSummary(): void {
    if (!this.data) {
      return;
    }

    const items = this.allItems;
    this.data.summary = {
      totalItems: items.length,
      completedItems: items.filter((item) => item.progress.status === 'completed').length,
      lectureCount: items.filter((item) => !this.isQuiz(item)).length,
      quizCount: items.filter((item) => this.isQuiz(item)).length,
      notesCount: items.filter((item) => Boolean(item.note)).length,
    };
  }

  private ensureQuizAnswers(itemId: number): Record<number, number[]> {
    if (!this.quizAnswers[itemId]) {
      this.quizAnswers[itemId] = {};
    }

    return this.quizAnswers[itemId];
  }

  private hasAttemptsRemaining(item: LearningItem): boolean {
    if (!item.quiz) {
      return false;
    }

    return item.quiz.maxAttempts === null || item.quiz.attemptsUsed < item.quiz.maxAttempts;
  }

  private extractYoutubeId(url: string): string {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return '';
    }

    try {
      const parsedUrl = new URL(trimmedUrl);

      if (parsedUrl.hostname.includes('youtu.be')) {
        return parsedUrl.pathname.replace('/', '');
      }

      return parsedUrl.searchParams.get('v') || '';
    } catch {
      const match = trimmedUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]+)/);

      return match?.[1] ?? '';
    }
  }
}
