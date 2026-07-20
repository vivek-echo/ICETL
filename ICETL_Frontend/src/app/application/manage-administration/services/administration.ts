import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_SPINNER } from '../../../commonServices/spinner/spinner.tokens';

export interface AdministrationApiResponse<T> {
  status: boolean;
  success?: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface LocationState {
  stateCode: number;
  stateName: string;
}

export interface LocationDistrict {
  districtCode: number;
  districtName: string;
}

export interface BranchPayload {
  stateCode: number;
  districtCode: number;
  branchName: string;
  branchAddress: string;
  status: number;
}

export interface Branch {
  id: number;
  stateCode: number;
  stateName: string;
  districtCode: number;
  districtName: string;
  branchName: string;
  branchAddress: string;
  status: number;
  statusLabel: string;
  createdOn: string | null;
  updatedOn: string | null;
}

export interface BranchListMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface BranchListSummary {
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
}

export interface BranchListResponse {
  status: boolean;
  success?: boolean;
  message: string;
  data: Branch[];
  meta: BranchListMeta;
  summary: BranchListSummary;
}

@Injectable({
  providedIn: 'root',
})
export class AdministrationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getStates(): Observable<AdministrationApiResponse<LocationState[]>> {
    return this.http.get<AdministrationApiResponse<LocationState[]>>(
      `${this.apiUrl}/administration/states`,
      this.backgroundRequestOptions(),
    );
  }

  getDistricts(stateCode: number): Observable<AdministrationApiResponse<LocationDistrict[]>> {
    return this.http.get<AdministrationApiResponse<LocationDistrict[]>>(
      `${this.apiUrl}/administration/districts`,
      {
        params: {
          stateCode,
        },
        ...this.backgroundRequestOptions(),
      },
    );
  }

  createBranch(payload: BranchPayload): Observable<AdministrationApiResponse<{ id: number }>> {
    return this.http.post<AdministrationApiResponse<{ id: number }>>(
      `${this.apiUrl}/administration/branches`,
      payload,
    );
  }

  getBranches(params: Record<string, string | number>): Observable<BranchListResponse> {
    return this.http.get<BranchListResponse>(`${this.apiUrl}/administration/branches`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
      ) as Record<string, string>,
      ...this.backgroundRequestOptions(),
    });
  }

  private backgroundRequestOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }
}
