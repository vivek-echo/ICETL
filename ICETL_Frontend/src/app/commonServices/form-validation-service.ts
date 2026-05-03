import { ElementRef, Injectable } from '@angular/core';
import { FormGroup, FormArray, AbstractControl } from '@angular/forms';
import { AlertHelperService } from './alert-helper-service';
@Injectable({
  providedIn: 'root',
})
export class FormValidationService {
  constructor(private alert: AlertHelperService) {}


  // MAIN METHOD
  validateForm(
    formGroup: FormGroup,
    getReadableFieldName: (fieldName: string) => string,
    el: ElementRef
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

  // 🔁 MARK ALL CONTROLS AS TOUCHED (recursive)
  private markAllAsTouched(control: AbstractControl): void {
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach(ctrl => {
        this.markAllAsTouched(ctrl);
      });
    }
    control.markAsTouched();
  }

  // 🎯 GET FIRST ERROR (important logic)
  private getFirstError(
    control: AbstractControl,
    getReadableFieldName: (fieldName: string) => string,
    parentKey: string = ''
  ): { controlName: string; message: string } | null {

    if (control instanceof FormGroup || control instanceof FormArray) {

      for (const key of Object.keys(control.controls)) {
        const child = control.get(key);

        const result = this.getFirstError(
          child!,
          getReadableFieldName,
          key
        );

        if (result) return result;
      }

    } else if (control.invalid && control.errors) {

      const fieldName = getReadableFieldName(parentKey);

      const errorKey = Object.keys(control.errors)[0];
      const errorValue = control.errors[errorKey];

      const message = this.formatErrorMessage(fieldName, errorKey, errorValue);

      return {
        controlName: parentKey,
        message
      };
    }

    return null;
  }

  // 🧠 FORMAT MESSAGE LIKE: "Email is required"
  private formatErrorMessage(field: string, errorKey: string, errorValue: any): string {

    const messages: any = {
      required: `${field} is required`,
      email: `${field} is not a valid email`,
      minlength: `${field} must be at least ${errorValue.requiredLength} characters`,
      maxlength: `${field} must be less than ${errorValue.requiredLength} characters`,
      pattern: `${field} format is invalid`,
      min: `${field} must be >= ${errorValue.min}`,
      max: `${field} must be <= ${errorValue.max}`,
    };

    return messages[errorKey] || `${field} is invalid`;
  }

  // 🎯 FOCUS FIRST INVALID FIELD
 private focusFirstInvalidControl(controlName: string, el: ElementRef): void {

  // Try multiple selectors (important)
  const selectors = [
    `[formControlName="${controlName}"]`,
    `input[formControlName="${controlName}"]`,
    `select[formControlName="${controlName}"]`,
    `textarea[formControlName="${controlName}"]`
  ];

  let element: HTMLElement | null = null;

  for (let selector of selectors) {
    element = el.nativeElement.querySelector(selector);
    if (element) break;
  }

  // Fallback (VERY IMPORTANT)
  if (!element) {
    element = document.querySelector('.ng-invalid') as HTMLElement;
  }

  if (element) {
    setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();

      // Optional highlight effect 🔥
      element.classList.add('focus-error');
      setTimeout(() => element?.classList.remove('focus-error'), 1500);

    }, 300); // wait for DOM
  }
}
}
