import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CompleteInstructorOnboardingPayload,
  INSTRUCTOR_REGISTRATION_ENDPOINTS,
  InstructorFinalRegistrationData,
  InstructorOnboardingSession,
  InstructorProfile,
  InstructorRegistrationResponse,
  InstructorStepResponseData,
  SaveAccountInformationPayload,
  SaveDocumentsAndSocialLinksFormValue,
  SaveProfessionalInformationFormValue,
  SaveSkillsAndCategoriesPayload,
} from './instructor-registration.model';

@Injectable({
  providedIn: 'root',
})
export class InstructorRegistrationService {
  private readonly baseUrl = environment.apiUrl;
  private readonly onboardingTokenKey = 'instructor_onboarding_token';
  private readonly onboardingTokenExpiryKey = 'instructor_onboarding_expires_at';

  constructor(private readonly http: HttpClient) {}

  saveAccountInformation(payload: SaveAccountInformationPayload) {
    return this.http.post<InstructorRegistrationResponse<InstructorStepResponseData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.saveAccountInformation}`,
      payload,
      {
        headers: this.getOnboardingHeaders(),
      },
    );
  }

  saveProfessionalInformation(payload: SaveProfessionalInformationFormValue) {
    return this.http.post<InstructorRegistrationResponse<InstructorStepResponseData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.saveProfessionalInformation}`,
      this.buildProfessionalInformationFormData(payload),
      {
        headers: this.getOnboardingHeaders(),
      },
    );
  }

  saveSkillsAndCategories(payload: SaveSkillsAndCategoriesPayload) {
    return this.http.post<InstructorRegistrationResponse<InstructorStepResponseData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.saveSkillsAndCategories}`,
      payload,
      {
        headers: this.getOnboardingHeaders(),
      },
    );
  }

  saveDocumentsAndSocialLinks(payload: SaveDocumentsAndSocialLinksFormValue) {
    return this.http.post<InstructorRegistrationResponse<InstructorStepResponseData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.saveDocumentsAndSocialLinks}`,
      this.buildDocumentsAndSocialLinksFormData(payload),
      {
        headers: this.getOnboardingHeaders(),
      },
    );
  }

  completeInstructorOnboarding(payload: CompleteInstructorOnboardingPayload) {
    return this.http.post<InstructorRegistrationResponse<InstructorFinalRegistrationData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.completeOnboarding}`,
      payload,
      {
        headers: this.getOnboardingHeaders(),
      },
    );
  }

  getInstructorProfile() {
    return this.http.get<
      InstructorRegistrationResponse<{ currentStep: number; instructor: InstructorProfile }>
    >(`${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.profile}`, {
      headers: this.getOnboardingHeaders(),
    });
  }

  buildStoredFileUrl(path?: string | null): string | null {
    const normalizedPath = `${path ?? ''}`.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath) {
      return null;
    }

    return `${this.baseUrl}/getAfile?path=${encodeURIComponent(normalizedPath)}`;
  }

  getAfile(path: string, download = false) {
    const normalizedPath = path.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    return this.http.get(`${this.baseUrl}/getAfile`, {
      headers: this.getOnboardingHeaders(),
      params: {
        path: normalizedPath,
        ...(download ? { download: '1' } : {}),
      },
      responseType: 'blob',
    });
  }

  downloadPrivateFile(path: string, fileName: string) {
    return this.getAfile(path, true).pipe(
      tap((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = objectUrl;
        link.download = fileName;
        link.click();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }),
      map(() => void 0),
    );
  }

  storeOnboardingSession(session: InstructorOnboardingSession): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.onboardingTokenKey, session.token);

    if (session.expiresAt) {
      localStorage.setItem(this.onboardingTokenExpiryKey, session.expiresAt);
    } else {
      localStorage.removeItem(this.onboardingTokenExpiryKey);
    }
  }

  clearOnboardingSession(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.onboardingTokenKey);
    localStorage.removeItem(this.onboardingTokenExpiryKey);
  }

  private buildProfessionalInformationFormData(
    payload: SaveProfessionalInformationFormValue,
  ): FormData {
    const formData = new FormData();

    formData.append('professionalHeadline', payload.professionalHeadline);
    formData.append('bio', payload.bio);
    formData.append('yearsOfExperience', String(payload.yearsOfExperience));
    formData.append('currentJobTitle', payload.currentJobTitle);
    formData.append('currentOrganization', payload.currentOrganization);
    formData.append('highestQualification', payload.highestQualification);

    if (payload.profilePhoto) {
      formData.append('profilePhoto', payload.profilePhoto);
    }

    return formData;
  }

  private buildDocumentsAndSocialLinksFormData(
    payload: SaveDocumentsAndSocialLinksFormValue,
  ): FormData {
    const formData = new FormData();

    if (payload.governmentId) {
      formData.append('governmentId', payload.governmentId);
    }

    if (payload.resume) {
      formData.append('resume', payload.resume);
    }

    payload.certifications?.forEach((file) => formData.append('certifications[]', file));

    if (payload.linkedInUrl?.trim()) {
      formData.append('linkedInUrl', payload.linkedInUrl.trim());
    }

    if (payload.gitHubUrl?.trim()) {
      formData.append('gitHubUrl', payload.gitHubUrl.trim());
    }

    if (payload.youTubeUrl?.trim()) {
      formData.append('youTubeUrl', payload.youTubeUrl.trim());
    }

    if (payload.portfolioWebsite?.trim()) {
      formData.append('portfolioWebsite', payload.portfolioWebsite.trim());
    }

    return formData;
  }

  private getOnboardingHeaders(): HttpHeaders {
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem(this.onboardingTokenKey) : null;

    return new HttpHeaders(
      token
        ? {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          }
        : {
            Accept: 'application/json',
          },
    );
  }
}
