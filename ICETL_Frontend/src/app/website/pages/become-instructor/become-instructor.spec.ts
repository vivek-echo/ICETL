import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { AuthService } from '../../../commonServices/auth.service';
import { SpinnerService } from '../../../commonServices/spinner/spinner.service';
import { InstructorRegistrationService } from '../../../services/instructor-registration.service';
import { OtpService } from '../../../services/otp.service';
import { BecomeInstructor } from './become-instructor';

describe('BecomeInstructor', () => {
  let component: BecomeInstructor;
  let fixture: ComponentFixture<BecomeInstructor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BecomeInstructor],
      providers: [
        provideRouter([]),
        {
          provide: SpinnerService,
          useValue: {
            show: () => undefined,
            hide: () => undefined,
          },
        },
        {
          provide: AuthService,
          useValue: {
            storeSession: () => undefined,
            getUser: () => ({}),
          },
        },
        {
          provide: OtpService,
          useValue: {
            sendInstructorOtp: () =>
              of({
                status: true,
                message: 'OTP sent successfully.',
                data: {
                  email: 'mentor@example.com',
                  flowType: 'resume',
                  currentStep: 3,
                  expiresIn: 300,
                  resendAvailableIn: 30,
                },
              }),
            resendInstructorOtp: () =>
              of({
                status: true,
                message: 'OTP resent successfully.',
                data: {
                  email: 'mentor@example.com',
                  flowType: 'resume',
                  currentStep: 3,
                  expiresIn: 300,
                  resendAvailableIn: 30,
                },
              }),
            verifyInstructorOtp: () => of({ status: true, data: {} }),
          },
        },
        {
          provide: AlertHelperService,
          useValue: {
            error: async () => undefined,
            success: async () => undefined,
          },
        },
        {
          provide: InstructorRegistrationService,
          useValue: {
            saveAccountInformation: () => of({ status: true, data: {} }),
            saveProfessionalInformation: () => of({ status: true, data: {} }),
            saveSkillsAndCategories: () => of({ status: true, data: {} }),
            saveDocumentsAndSocialLinks: () => of({ status: true, data: {} }),
            completeInstructorOnboarding: () => of({ status: true, data: {} }),
            getInstructorProfile: () => of({ status: true, data: {} }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BecomeInstructor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('moves to the OTP stage without triggering a sync transition issue', async () => {
    component.emailEntryForm.setValue({ email: 'mentor@example.com' });

    await component.submitEmail();

    expect(component.stage).toBe('otp');
    expect(component.onboardingEmail).toBe('mentor@example.com');
    expect(component.flowType).toBe('resume');
  });
});
