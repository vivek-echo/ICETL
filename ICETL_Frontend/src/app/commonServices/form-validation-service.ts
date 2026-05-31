import { ElementRef, Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { AlertHelperService } from './alert-helper-service';

@Injectable({
  providedIn: 'root',
})
export class FormValidationService {
  constructor(private alert: AlertHelperService) {}

  validateForm(
    formGroup: FormGroup,
    getReadableFieldName: (fieldName: string) => string,
    el: ElementRef,
  ): boolean {
    if (formGroup.valid) return true;

    this.markAllAsTouched(formGroup);

    const firstError = this.getFirstError(formGroup, getReadableFieldName);

    if (firstError) {
      this.alert.error(firstError.message);

      setTimeout(() => {
        this.focusFirstInvalidControl(firstError.controlName, el);
      }, 200);
    }

    return false;
  }

  private markAllAsTouched(control: AbstractControl): void {
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach((ctrl) => {
        this.markAllAsTouched(ctrl);
      });
    }

    control.markAsTouched();
  }

  private getFirstError(
    control: AbstractControl,
    getReadableFieldName: (fieldName: string) => string,
    parentKey = '',
  ): { controlName: string; message: string } | null {
    if (control instanceof FormGroup || control instanceof FormArray) {
      for (const key of Object.keys(control.controls)) {
        const child = control.get(key);
        const result = child ? this.getFirstError(child, getReadableFieldName, key) : null;

        if (result) return result;
      }
    }

    if (control.invalid && control.errors) {
      const errorKey = Object.keys(control.errors)[0];
      const errorValue = control.errors[errorKey];
      const controlName = this.getControlNameForError(parentKey, errorKey);
      const fieldName = getReadableFieldName(controlName || parentKey || errorKey);

      return {
        controlName,
        message: this.formatErrorMessage(fieldName, errorKey, errorValue),
      };
    }

    return null;
  }

  private formatErrorMessage(field: string, errorKey: string, errorValue: any): string {
    const messages: Record<string, string> = {
      required: `${field} is required`,
      requiredTrue: `${field} must be accepted`,
      email: `${field} is not a valid email`,
      minlength: `${field} must be at least ${errorValue?.requiredLength} characters`,
      maxlength: `${field} must be at most ${errorValue?.requiredLength} characters`,
      pattern: `${field} format is invalid`,
      nameOnly: `${field} can contain only letters and spaces`,
      mobileOnly: `${field} must be exactly 10 digits`,
      min: `${field} must be >= ${errorValue?.min}`,
      max: `${field} must be <= ${errorValue?.max}`,
      mismatch: `${field} does not match`,
      selectionRequired: `${field} is required`,
      fileRequired: `${field} is required`,
      dateBeforeToday: `${field} must be before today`,
      dateRange: `${field} cannot be earlier than start date`,
      timeRange: `${field} must be later than start time`,
    };

    return messages[errorKey] || `${field} is invalid`;
  }

  private getControlNameForError(parentKey: string, errorKey: string): string {
    const groupErrorFocusMap: Record<string, string> = {
      mismatch: 'confirmPassword',
      dateRange: 'endDate',
      timeRange: 'endTime',
    };

    return groupErrorFocusMap[errorKey] || parentKey;
  }

  private focusFirstInvalidControl(controlName: string, el: ElementRef): void {
    const selectors = [
      `[formControlName="${controlName}"]`,
      `[name="${controlName}"]`,
      `[data-validation-control="${controlName}"]`,
      `input[formControlName="${controlName}"]`,
      `select[formControlName="${controlName}"]`,
      `textarea[formControlName="${controlName}"]`,
    ];

    let element: HTMLElement | null = null;

    for (const selector of selectors) {
      element = el.nativeElement.querySelector(selector);
      if (element) break;
    }

    if (!element) {
      element = el.nativeElement.querySelector('.ng-invalid:not(form)') as HTMLElement;
    }

    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
        element.classList.add('focus-error');
        setTimeout(() => element?.classList.remove('focus-error'), 1500);
      }, 300);
    }
  }
}
