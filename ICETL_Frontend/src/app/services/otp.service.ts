import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  INSTRUCTOR_REGISTRATION_ENDPOINTS,
  InstructorOtpStartData,
  InstructorOtpVerificationResult,
  InstructorRegistrationResponse,
} from './instructor-registration.model';

@Injectable({
  providedIn: 'root',
})
export class OtpService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  sendInstructorOtp(email: string) {
    return this.http.post<InstructorRegistrationResponse<InstructorOtpStartData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.sendOtp}`,
      { email },
    );
  }

  resendInstructorOtp(email: string) {
    return this.http.post<InstructorRegistrationResponse<InstructorOtpStartData>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.resendOtp}`,
      { email },
    );
  }

  verifyInstructorOtp(email: string, otp: string) {
    return this.http.post<InstructorRegistrationResponse<InstructorOtpVerificationResult>>(
      `${this.baseUrl}${INSTRUCTOR_REGISTRATION_ENDPOINTS.verifyOtp}`,
      { email, otp },
    );
  }
}
