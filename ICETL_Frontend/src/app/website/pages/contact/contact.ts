import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AlertHelperService } from '../../../commonServices/alert-helper-service';
import { ContactEnquiryService } from '../../../commonServices/contact-enquiry.service';

interface ContactCard {
  title: string;
  iconClass: string;
  lines: string[];
}

interface ContactFeature {
  title: string;
  description: string;
  iconClass: string;
}

@Component({
  selector: 'app-contact',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);

  readonly coursesRoute = '/courses';
  readonly contactEmail = 'info@ictel.in';
  readonly supportEmail = 'contact@icetl.com';

  readonly contactImages = [
    'assets/images/contact/contact1.png',
    'assets/images/contact/contact2.png',
  ];

  readonly enquiryOptions = [
    'Course Guidance',
    'Admission',
    'Internship',
    'Certification',
    'Technical Support',
    'Other',
  ];

  isSubmitting = false;
  formSubmitted = false;

  readonly enquiryForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    phone: [
      '',
      [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/), Validators.maxLength(20)],
    ],
    enquiryType: ['Course Guidance', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  readonly contactCards: ContactCard[] = [
    {
      title: 'Visit Us',
      iconClass: 'fa-solid fa-location-dot',
      lines: [' Ice Technology Lab', 'Anjali Apartment, Mitra Compound, Boring Road, Patna - 800001'],
    },
    {
      title: 'Call Us',
      iconClass: 'fa-solid fa-phone',
      lines: ['+91 8797078611 , +91 8797078612'],
    },
    {
      title: 'Email Us',
      iconClass: 'fa-solid fa-envelope',
      lines: ['info@ictel.in', 'support@ictel.in'],
    },
    {
      title: 'Working Hours',
      iconClass: 'fa-solid fa-clock',
      lines: ['Monday - Saturday', '9:00 AM - 6:00 PM'],
    },
  ];

  readonly whyContactCards: ContactFeature[] = [
    {
      title: 'Course Guidance',
      description: 'Get help choosing the right training path for your skills and career goals.',
      iconClass: 'fa-solid fa-route',
    },
    {
      title: 'Career Counseling',
      description: 'Talk with our team about roles, roadmaps, interviews, and practical next steps.',
      iconClass: 'fa-solid fa-compass',
    },
    {
      title: 'Internship Support',
      description: 'Understand internship options, project exposure, and profile-building support.',
      iconClass: 'fa-solid fa-user-check',
    },
    {
      title: 'Certification Assistance',
      description: 'Get guidance on certification-focused learning and course completion details.',
      iconClass: 'fa-solid fa-certificate',
    },
    {
      title: 'Technical Support',
      description: 'Reach us for learner support, access help, and training-related technical queries.',
      iconClass: 'fa-solid fa-headset',
    },
    {
      title: 'Admission Help',
      description: 'Ask about batches, fees, enrollment steps, schedules, and course availability.',
      iconClass: 'fa-solid fa-file-signature',
    },
  ];

  constructor(
    private readonly contactEnquiryService: ContactEnquiryService,
    private readonly alertHelper: AlertHelperService,
  ) {}

  async handleContactSubmit(): Promise<void> {
    this.formSubmitted = true;

    if (this.enquiryForm.invalid) {
      this.enquiryForm.markAllAsTouched();
      return;
    }

    const formValue = this.enquiryForm.getRawValue();

    this.isSubmitting = true;

    try {
      const response = await lastValueFrom(
        this.contactEnquiryService.submitEnquiry({
          fullName: formValue.fullName || '',
          email: formValue.email || '',
          phone: formValue.phone || '',
          enquiryType: formValue.enquiryType || 'Other',
          subject: formValue.subject || '',
          message: formValue.message || '',
        }),
      );

      if (response.status) {
        await this.alertHelper.success(response.message || 'Enquiry submitted successfully');
        this.enquiryForm.reset({
          fullName: '',
          email: '',
          phone: '',
          enquiryType: 'Course Guidance',
          subject: '',
          message: '',
        });
        this.formSubmitted = false;
        return;
      }

      await this.alertHelper.error(response.message || 'Unable to submit enquiry');
    } catch (error: any) {
      await this.alertHelper.error(this.getErrorMessage(error), 'Enquiry Form');
    } finally {
      this.isSubmitting = false;
    }
  }

  isInvalid(fieldName: keyof typeof this.enquiryForm.controls): boolean {
    const control = this.enquiryForm.controls[fieldName];

    return control.invalid && (control.touched || this.formSubmitted);
  }

  getErrorText(fieldName: keyof typeof this.enquiryForm.controls): string {
    const control = this.enquiryForm.controls[fieldName];

    if (control.errors?.['required']) {
      return 'This field is required.';
    }

    if (control.errors?.['email']) {
      return 'Enter a valid email address.';
    }

    if (control.errors?.['pattern']) {
      return 'Enter a valid phone number.';
    }

    if (control.errors?.['minlength']) {
      return `Minimum ${control.errors['minlength'].requiredLength} characters required.`;
    }

    return 'Please check this field.';
  }

  onlyPhoneCharacters(event: KeyboardEvent): boolean {
    const value = event.key;

    if (!/^[0-9+\-\s()]$/.test(value)) {
      event.preventDefault();
      return false;
    }

    return true;
  }

  private getErrorMessage(error: any): string {
    const validationErrors = error?.error?.errors;

    if (validationErrors) {
      const firstError = Object.values(validationErrors)
        .flat()
        .find((message): message is string => typeof message === 'string' && message.length > 0);

      if (firstError) {
        return firstError;
      }
    }

    return error?.error?.message || 'Unable to submit enquiry';
  }
}
