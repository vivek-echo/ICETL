import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export interface LearningApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface LearningCourse {
  enrollmentId: number;
  id: number;
  title: string;
  categoryId?: number;
  categoryName?: string | null;
  instructors?: Array<{ id: number; name: string }>;
  instructorName?: string | null;
  duration?: number | string | null;
  durationUnit?: number | string | null;
  description?: string | null;
  courseHighlights?: string[];
  thumbnailUrl?: string | null;
  status: number;
  progressPercent: number;
  lastWatchedAt?: string | null;
  enrolledAt?: string | null;
}

export interface LearningSummary {
  totalItems: number;
  completedItems: number;
  lectureCount: number;
  quizCount: number;
  notesCount: number;
}

export interface LearningProgress {
  id: number | null;
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercent: number;
  lastPositionSeconds?: number;
  completedAt?: string | null;
  updatedAt?: string | null;
}

export interface LearningNote {
  id: number;
  note: string;
  updatedAt?: string | null;
}

export interface LearningQuizOption {
  id: number;
  questionId: number;
  optionText: string;
  sortOrder: number;
}

export interface LearningQuizQuestion {
  id: number;
  curriculumItemId: number;
  question: string;
  questionType: 'single_choice' | 'multiple_choice' | 'true_false';
  explanation?: string | null;
  marks: number;
  sortOrder: number;
  options: LearningQuizOption[];
}

export interface LearningQuizAttempt {
  id: number;
  attemptNo: number;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  completedAt?: string | null;
}

export interface LearningQuiz {
  questionCount: number;
  questions: LearningQuizQuestion[];
  attemptsUsed: number;
  maxAttempts: number | null;
  canAttempt: boolean;
  latestAttempt: LearningQuizAttempt | null;
}

export interface LearningItem {
  id: number;
  sectionId: number;
  title: string;
  type: 'lecture' | 'quiz' | string;
  contentType?: 'youtube' | 'upload' | 'article' | string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  fileUrl?: string | null;
  rawFileUrl?: string | null;
  description?: string | null;
  duration?: string | null;
  passingPercentage?: number | null;
  timeLimit?: number | null;
  allowMultipleAttempts?: boolean;
  maxAttempts?: number | null;
  isPreview?: boolean;
  sortOrder: number;
  progress: LearningProgress;
  note: LearningNote | null;
  quiz: LearningQuiz | null;
}

export interface LearningSection {
  id: number;
  courseId: number;
  title: string;
  objective?: string | null;
  sortOrder: number;
  items: LearningItem[];
}

export interface LearningCoursePayload {
  course: LearningCourse;
  summary: LearningSummary;
  sections: LearningSection[];
}

export interface LearningProgressPayload {
  courseId: number;
  curriculumItemId: number;
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercent?: number;
  lastPositionSeconds?: number;
}

export interface LearningNotePayload {
  courseId: number;
  curriculumItemId: number;
  note: string;
}

export interface LearningQuizAnswerPayload {
  questionId: number;
  selectedOptionIds: number[];
}

export interface LearningQuizReviewItem {
  questionId: number;
  question: string;
  questionType: string;
  selectedOptionIds: number[];
  correctOptionIds: number[];
  isCorrect: boolean;
  earnedMarks: number;
  marks: number;
  explanation?: string | null;
}

export interface LearningQuizSubmitResult {
  attempt: LearningQuizAttempt;
  review: LearningQuizReviewItem[];
  progress: LearningProgress;
  courseProgressPercent: number;
}

@Injectable({
  providedIn: 'root',
})
export class LearningService {
  private readonly API_URL = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getCourse(courseId: number): Observable<LearningApiResponse<LearningCoursePayload>> {
    return this.http.get<LearningApiResponse<LearningCoursePayload>>(
      `${this.API_URL}/learning/course/${courseId}`,
      this.skipGlobalSpinnerOptions(),
    );
  }

  saveProgress(
    payload: LearningProgressPayload,
  ): Observable<LearningApiResponse<{ progress: LearningProgress; courseProgressPercent: number }>> {
    return this.http.post<
      LearningApiResponse<{ progress: LearningProgress; courseProgressPercent: number }>
    >(`${this.API_URL}/learning/progress`, payload, this.skipGlobalSpinnerOptions());
  }

  saveNote(payload: LearningNotePayload): Observable<LearningApiResponse<LearningNote | null>> {
    return this.http.post<LearningApiResponse<LearningNote | null>>(
      `${this.API_URL}/learning/notes`,
      payload,
      this.skipGlobalSpinnerOptions(),
    );
  }

  submitQuiz(
    courseId: number,
    quizId: number,
    answers: LearningQuizAnswerPayload[],
  ): Observable<LearningApiResponse<LearningQuizSubmitResult>> {
    return this.http.post<LearningApiResponse<LearningQuizSubmitResult>>(
      `${this.API_URL}/learning/quiz/${quizId}/submit`,
      { courseId, answers },
      this.skipGlobalSpinnerOptions(),
    );
  }

  private skipGlobalSpinnerOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }
}
