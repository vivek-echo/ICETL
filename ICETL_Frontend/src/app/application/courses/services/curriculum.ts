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

@Injectable({
  providedIn: 'root',
})
export class CurriculumService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
}
