import { HttpClient, HttpContext, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';
import { CurriculumItem, Section } from '../models/curriculum.model';

export interface CurriculumApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export type SectionPayload = Partial<Omit<Section, 'id' | 'items'>>;
export type CurriculumItemPayload = Partial<Omit<CurriculumItem, 'id'>>;
export interface SortOrderPayload {
  id: number;
  sortOrder: number;
}

export interface CurriculumVideoUploadResponse {
  fileUrl: string;
  fileName: string;
  originalName: string;
}

export interface CurriculumQuiz {
  id: number;
  sectionId: number;
  title: string;
  type: string;
  description: string;
  passingPercentage: number | null;
  timeLimit: number | null;
  allowMultipleAttempts: number | boolean;
  maxAttempts: number | null;
  isPreview: number | boolean;
  sortOrder: number;
}

export interface CurriculumQuizPayload {
  sectionId?: number;
  title?: string;
  description?: string;
  passingPercentage?: number | null;
  timeLimit?: number | null;
  allowMultipleAttempts?: boolean;
  maxAttempts?: number | null;
  isPreview?: boolean;
}

export interface CurriculumQuizQuestionOption {
  id?: number;
  questionId?: number;
  optionText: string;
  isCorrect: number | boolean;
  sortOrder?: number;
}

export interface CurriculumQuizQuestion {
  id: number;
  curriculumItemId: number;
  question: string;
  questionType: 'single_choice' | 'multiple_choice' | 'true_false';
  explanation: string | null;
  marks: number;
  sortOrder: number;
  options: CurriculumQuizQuestionOption[];
}

export interface CurriculumQuizQuestionPayload {
  curriculumItemId?: number;
  question?: string;
  questionType?: 'single_choice' | 'multiple_choice' | 'true_false';
  explanation?: string;
  marks?: number;
  options?: Array<{
    optionText: string;
    isCorrect: boolean;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class CurriculumService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  buildPrivateFileUrl(path: string): string {
    const normalizedPath = `${path || ''}`.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    return `${this.API_URL}/getAfile?path=${encodeURIComponent(normalizedPath)}`;
  }

  private skipGlobalSpinnerOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }

  getSections(data: any): Observable<CurriculumApiResponse<Section[]>> {
    return this.http.post<CurriculumApiResponse<Section[]>>(
      `${this.API_URL}/curriculum/section/list`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  addSection(data: any): Observable<CurriculumApiResponse<Section>> {
    return this.http.post<CurriculumApiResponse<Section>>(
      `${this.API_URL}/curriculum/section/add`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateSection(data: any): Observable<CurriculumApiResponse<Section>> {
    return this.http.post<CurriculumApiResponse<Section>>(
      `${this.API_URL}/curriculum/section/update`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateSectionOrder(data: SortOrderPayload[]): Observable<CurriculumApiResponse<Section[]>> {
    return this.http.post<CurriculumApiResponse<Section[]>>(
      `${this.API_URL}/curriculum/section/order`,
      { data },
      this.skipGlobalSpinnerOptions(),
    );
  }

  deleteSection(data: any): Observable<CurriculumApiResponse<null>> {
    return this.http.post<CurriculumApiResponse<null>>(
      `${this.API_URL}/curriculum/section/delete`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  uploadItemVideo(file: File): Observable<HttpEvent<CurriculumApiResponse<CurriculumVideoUploadResponse>>> {
    const formData = new FormData();
    formData.append('video', file);

    return this.http.post<CurriculumApiResponse<CurriculumVideoUploadResponse>>(
      `${this.API_URL}/curriculum/item/video/upload`,
      formData,
      {
        ...this.skipGlobalSpinnerOptions(),
        reportProgress: true,
        observe: 'events' as const,
      },
    );
  }

  getItems(sectionId: number): Observable<CurriculumApiResponse<CurriculumItem[]>> {
    return this.http.post<CurriculumApiResponse<CurriculumItem[]>>(
      `${this.API_URL}/curriculum/item/list`,
      { sectionId },
      this.skipGlobalSpinnerOptions(),
    );
  }

  addItem(data: CurriculumItemPayload): Observable<CurriculumApiResponse<CurriculumItem>> {
    return this.http.post<CurriculumApiResponse<CurriculumItem>>(
      `${this.API_URL}/curriculum/item/add`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateItem(
    id: number,
    data: CurriculumItemPayload,
  ): Observable<CurriculumApiResponse<CurriculumItem>> {
    return this.http.post<CurriculumApiResponse<CurriculumItem>>(
      `${this.API_URL}/curriculum/item/update`,
      {
        id,
        ...data,
      },
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateItemOrder(data: SortOrderPayload[]): Observable<CurriculumApiResponse<CurriculumItem[]>> {
    return this.http.post<CurriculumApiResponse<CurriculumItem[]>>(
      `${this.API_URL}/curriculum/item/order`,
      { data },
      this.skipGlobalSpinnerOptions(),
    );
  }

  deleteItem(id: number): Observable<CurriculumApiResponse<null>> {
    return this.http.post<CurriculumApiResponse<null>>(
      `${this.API_URL}/curriculum/item/delete`,
      { id },
      this.skipGlobalSpinnerOptions(),
    );
  }

  addQuiz(data: CurriculumQuizPayload): Observable<CurriculumApiResponse<CurriculumQuiz>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuiz>>(
      `${this.API_URL}/curriculum/quiz/add`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateQuiz(
    id: number,
    data: CurriculumQuizPayload,
  ): Observable<CurriculumApiResponse<CurriculumQuiz>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuiz>>(
      `${this.API_URL}/curriculum/quiz/update`,
      {
        id,
        ...data,
      },
      this.skipGlobalSpinnerOptions(),
    );
  }

  deleteQuiz(id: number): Observable<CurriculumApiResponse<null>> {
    return this.http.post<CurriculumApiResponse<null>>(
      `${this.API_URL}/curriculum/quiz/delete`,
      { id },
      this.skipGlobalSpinnerOptions(),
    );
  }

  getQuiz(sectionId: number): Observable<CurriculumApiResponse<CurriculumQuiz[]>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuiz[]>>(
      `${this.API_URL}/curriculum/quiz/list`,
      { sectionId },
      this.skipGlobalSpinnerOptions(),
    );
  }

  addQuizQuestion(
    data: CurriculumQuizQuestionPayload,
  ): Observable<CurriculumApiResponse<CurriculumQuizQuestion>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuizQuestion>>(
      `${this.API_URL}/quiz/question/add`,
      data,
      this.skipGlobalSpinnerOptions(),
    );
  }

  updateQuizQuestion(
    id: number,
    data: CurriculumQuizQuestionPayload,
  ): Observable<CurriculumApiResponse<CurriculumQuizQuestion>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuizQuestion>>(
      `${this.API_URL}/quiz/question/update`,
      {
        id,
        ...data,
      },
      this.skipGlobalSpinnerOptions(),
    );
  }

  deleteQuizQuestion(id: number): Observable<CurriculumApiResponse<null>> {
    return this.http.post<CurriculumApiResponse<null>>(
      `${this.API_URL}/quiz/question/delete`,
      { id },
      this.skipGlobalSpinnerOptions(),
    );
  }

  getQuizQuestions(
    curriculumItemId: number,
  ): Observable<CurriculumApiResponse<CurriculumQuizQuestion[]>> {
    return this.http.post<CurriculumApiResponse<CurriculumQuizQuestion[]>>(
      `${this.API_URL}/quiz/question/list`,
      { curriculumItemId },
      this.skipGlobalSpinnerOptions(),
    );
  }
}
