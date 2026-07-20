import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export class FormValidationRules {
  static readonly namePattern = /^[A-Za-z](?:[A-Za-z ]*[A-Za-z])?$/;
  static readonly mobilePattern = /^[0-9]{10}$/;

  static requiredName(maxLength = 150): ValidatorFn[] {
    return [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(maxLength),
      FormValidationRules.nameOnly(),
    ];
  }

  static requiredMobile(): ValidatorFn[] {
    return [Validators.required, FormValidationRules.mobileOnly()];
  }

  private static nameOnly(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = `${control.value ?? ''}`.trim();

      return !value || FormValidationRules.namePattern.test(value) ? null : { nameOnly: true };
    };
  }

  private static mobileOnly(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = `${control.value ?? ''}`.trim();

      return !value || FormValidationRules.mobilePattern.test(value) ? null : { mobileOnly: true };
    };
  }
}
