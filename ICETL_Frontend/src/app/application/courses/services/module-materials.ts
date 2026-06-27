import {
  HttpClient,
  HttpContext,
  HttpEvent,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export type ModuleType = 'ACADEMIC_COURSE' | 'WORKSHOP' | 'SEMINAR';

export interface ApiResponse<T> {
  status?: boolean;
  success?: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  from?: number | null;
  to?: number | null;
}

export interface AssignedModule {
  id: number;
  moduleId: number;
  moduleType: ModuleType;
  moduleTypeLabel: string;
  code?: string | null;
  title: string;
  subtitle?: string | null;
  isSpecial?: boolean | number;
  parentCourseId?: number | null;
  parentCourseTitle?: string | null;
  parentCourseCode?: string | null;
  thumbnailUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: number;
  statusLabel?: string | null;
  scheduleStatus?: 'upcoming' | 'ongoing' | 'completed' | string;
  materialsCount: number;
  createdOn?: string | null;
}

export interface AssignedModuleFilters {
  moduleType: ModuleType;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface AssignedModuleListResponse {
  status?: boolean;
  success?: boolean;
  message: string;
  data: AssignedModule[];
  meta: PaginationMeta;
}

export interface AssignedModuleStudent {
  id: number;
  enrollmentId?: number | null;
  moduleType: ModuleType;
  moduleId: number;
  studentId: number;
  studentCode?: string | null;
  studentName: string;
  studentEmail: string;
  studentPhone?: string | null;
  studentDob?: string | null;
  studentGender?: number | null;
  enrollmentStatus?: string | null;
  enrolledAt?: string | null;
  orderReference?: string | null;
  invoiceNumber?: string | null;
  paymentMode?: string | null;
  amountPaid: number;
}

export interface AssignedModuleStudentSummary {
  totalEnrollments: number;
  totalStudents: number;
  totalPaid: number;
}

export interface AssignedModuleStudentFilters {
  moduleType: ModuleType;
  moduleId: number;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface AssignedModuleStudentListResponse {
  status?: boolean;
  success?: boolean;
  message: string;
  data: AssignedModuleStudent[];
  summary: AssignedModuleStudentSummary;
  meta: PaginationMeta;
}

export interface ModuleMaterial {
  id: number;
  moduleType: ModuleType;
  moduleId: number;
  title: string;
  description?: string | null;
  materialDate?: string | null;
  originalFileName: string;
  fileExtension?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  fileSizeLabel?: string | null;
  uploadedBy?: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
  downloadUrl?: string;
  viewUrl?: string;
}

export interface UploadModuleMaterialPayload {
  moduleType: ModuleType;
  moduleId: number;
  title: string;
  description?: string;
  materialDate?: string;
  file: File;
}

@Injectable({
  providedIn: 'root',
})
export class ModuleMaterialsService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getAssignedModules(filters: AssignedModuleFilters): Observable<AssignedModuleListResponse> {
    let params = new HttpParams()
      .set('moduleType', filters.moduleType)
      .set('page', String(filters.page ?? 1))
      .set('perPage', String(filters.perPage ?? 10));

    const search = `${filters.search ?? ''}`.trim();
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<AssignedModuleListResponse>(`${this.apiUrl}/instructor/assigned-modules`, {
      params,
      ...this.skipGlobalSpinnerOptions(),
    });
  }

  getAssignedModuleStudents(
    filters: AssignedModuleStudentFilters,
  ): Observable<AssignedModuleStudentListResponse> {
    let params = new HttpParams()
      .set('moduleType', filters.moduleType)
      .set('moduleId', String(filters.moduleId))
      .set('page', String(filters.page ?? 1))
      .set('perPage', String(filters.perPage ?? 10));

    const search = `${filters.search ?? ''}`.trim();
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<AssignedModuleStudentListResponse>(
      `${this.apiUrl}/instructor/assigned-module-students`,
      {
        params,
        ...this.skipGlobalSpinnerOptions(),
      },
    );
  }

  getMaterials(
    moduleType: ModuleType,
    moduleId: number,
  ): Observable<ApiResponse<ModuleMaterial[]>> {
    const params = new HttpParams()
      .set('moduleType', moduleType)
      .set('moduleId', String(moduleId));

    return this.http.get<ApiResponse<ModuleMaterial[]>>(`${this.apiUrl}/module-materials`, {
      params,
      ...this.skipGlobalSpinnerOptions(),
    });
  }

  uploadMaterial(
    payload: UploadModuleMaterialPayload,
  ): Observable<HttpEvent<ApiResponse<ModuleMaterial>>> {
    const formData = new FormData();
    formData.append('moduleType', payload.moduleType);
    formData.append('moduleId', String(payload.moduleId));
    formData.append('title', payload.title);
    formData.append('description', payload.description ?? '');
    formData.append('materialDate', payload.materialDate ?? '');
    formData.append('file', payload.file);

    return this.http.post<ApiResponse<ModuleMaterial>>(
      `${this.apiUrl}/module-materials`,
      formData,
      {
        observe: 'events',
        reportProgress: true,
        ...this.skipGlobalSpinnerOptions(),
      },
    );
  }

  downloadMaterial(id: number, download = true): Observable<HttpResponse<Blob>> {
    const params = download ? new HttpParams().set('download', '1') : new HttpParams();

    return this.http.get(`${this.apiUrl}/module-materials/${id}/download`, {
      params,
      observe: 'response',
      responseType: 'blob',
      ...this.skipGlobalSpinnerOptions(),
    });
  }

  deleteMaterial(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/module-materials/${id}`,
      this.skipGlobalSpinnerOptions(),
    );
  }

  private skipGlobalSpinnerOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }
}
