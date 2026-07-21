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

export interface RoleOption {
  id: number;
  roleName: string;
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

export interface EmployeePayload {
  stateCode: number;
  districtCode: number;
  branchId: number;
  name: string;
  email: string;
  phone: string;
  dob?: string | null;
  gender?: string | number | null;
  status: number;
}

export interface EmployeeUser {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  dob: string | null;
  gender: string | number | null;
  role: number;
  roleName: string;
  stateCode: number;
  stateName: string;
  districtCode: number;
  districtName: string;
  branchId: number;
  branchName: string;
  status: number;
  statusLabel: string;
  deletedFlag: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmployeeListMeta {
  currentPage: number;
  perPage: number | 'all';
  total: number;
  lastPage: number;
  from: number | null;
  to: number | null;
}

export interface EmployeeListSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}

export interface EmployeeListResponse {
  status: boolean;
  success?: boolean;
  message: string;
  data: EmployeeUser[];
  meta: EmployeeListMeta;
  summary: EmployeeListSummary;
}

export interface InstructorAdminUserDetails extends EmployeeUser {
  userType: number | null;
  profileStage: number | null;
  profileImg: string;
  thumbnailImg: string;
  profileImgUrl: string | null;
  thumbnailImgUrl: string | null;
  emailVerifiedAt: string | null;
}

export interface InstructorAdminDocument {
  id: number;
  userId: number;
  documentType: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileUrl: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface InstructorAdminProfile {
  id: number;
  userId: number;
  headline: string;
  bio: string;
  experienceYears: number | null;
  currentJobTitle: string;
  currentOrganization: string;
  qualification: string;
  country: string;
  preferredLanguage: string;
  linkedinUrl: string;
  githubUrl: string;
  youtubeUrl: string;
  portfolioUrl: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
  approvalStatus: string;
  status: number;
  statusLabel: string;
  profilePhotoUrl: string | null;
  skills: string[];
  categories: string[];
  languagesYouCanTeach: string[];
  documents: InstructorAdminDocument[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InstructorAdminDetails {
  user: InstructorAdminUserDetails;
  profile: InstructorAdminProfile | null;
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

  getRoles(): Observable<AdministrationApiResponse<RoleOption[]>> {
    return this.http.get<AdministrationApiResponse<RoleOption[]>>(
      `${this.apiUrl}/administration/roles`,
      this.backgroundRequestOptions(),
    );
  }

  createBranch(payload: BranchPayload): Observable<AdministrationApiResponse<{ id: number }>> {
    return this.http.post<AdministrationApiResponse<{ id: number }>>(
      `${this.apiUrl}/administration/branches`,
      payload,
    );
  }

  getBranches(params: Record<string, string | number | null | undefined>): Observable<BranchListResponse> {
    return this.http.get<BranchListResponse>(`${this.apiUrl}/administration/branches`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
      ) as Record<string, string>,
      ...this.backgroundRequestOptions(),
    });
  }

  createEmployee(payload: EmployeePayload): Observable<AdministrationApiResponse<{
    id: number;
    roleId: number;
    defaultPassword: string;
  }>> {
    return this.http.post<AdministrationApiResponse<{
      id: number;
      roleId: number;
      defaultPassword: string;
    }>>(`${this.apiUrl}/administration/employees`, payload);
  }

  getEmployeeUsers(params: Record<string, string | number | null | undefined>): Observable<EmployeeListResponse> {
    return this.http.get<EmployeeListResponse>(`${this.apiUrl}/administration/employees`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
      ) as Record<string, string>,
      ...this.backgroundRequestOptions(),
    });
  }

  resetEmployeePassword(employeeId: number): Observable<AdministrationApiResponse<{ defaultPassword: string }>> {
    return this.http.post<AdministrationApiResponse<{ defaultPassword: string }>>(
      `${this.apiUrl}/administration/employees/${employeeId}/reset-password`,
      {},
    );
  }

  updateEmployeeStatus(employeeId: number, status: number): Observable<AdministrationApiResponse<null>> {
    return this.http.post<AdministrationApiResponse<null>>(
      `${this.apiUrl}/administration/employees/${employeeId}/status`,
      { status },
    );
  }

  getInstructorDetails(userId: number): Observable<AdministrationApiResponse<InstructorAdminDetails>> {
    return this.http.get<AdministrationApiResponse<InstructorAdminDetails>>(
      `${this.apiUrl}/administration/users/${userId}/instructor-profile`,
      this.backgroundRequestOptions(),
    );
  }

  private backgroundRequestOptions(): { context: HttpContext } {
    return {
      context: new HttpContext().set(SKIP_SPINNER, true),
    };
  }
}
