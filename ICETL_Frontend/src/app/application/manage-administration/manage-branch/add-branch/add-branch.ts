import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, afterNextRender } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';

import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import {
  AdministrationService,
  LocationDistrict,
  LocationState,
} from '../../services/administration';

@Component({
  selector: 'app-add-branch',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-branch.html',
  styleUrl: './add-branch.scss',
})
export class AddBranch {
  states: LocationState[] = [];
  districts: LocationDistrict[] = [];
  loadingStates = false;
  loadingDistricts = false;
  isSubmitting = false;
  selectedStateCode = '';

  branchForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly administrationService: AdministrationService,
    private readonly formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private readonly spinner: NgxSpinnerService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.branchForm = this.fb.group({
      stateCode: ['', Validators.required],
      districtCode: [{ value: '', disabled: true }, Validators.required],
      branchName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      branchAddress: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
      status: ['1', Validators.required],
    });

    afterNextRender(() => {
      void this.loadStates();
    });
  }

  async loadStates(): Promise<void> {
    this.loadingStates = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getStates());
      this.states = response.status ? response.data : [];
    } catch (error: any) {
      this.states = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load states. Please try again.',
        'Branch Location',
      );
    } finally {
      this.loadingStates = false;
      this.cdr.detectChanges();
    }
  }

  onStateChange(): void {
    this.selectedStateCode = `${this.branchForm.get('stateCode')?.value ?? ''}`;
    const stateCode = Number(this.selectedStateCode || 0);
    const districtControl = this.branchForm.get('districtCode');

    districtControl?.reset('');
    this.districts = [];

    if (!stateCode) {
      districtControl?.disable();
      this.cdr.detectChanges();
      return;
    }

    districtControl?.enable();
    this.cdr.detectChanges();
    void this.loadDistricts(stateCode);
  }

  async loadDistricts(stateCode: number): Promise<void> {
    this.loadingDistricts = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(this.administrationService.getDistricts(stateCode));
      this.districts = response.status ? response.data : [];
    } catch (error: any) {
      this.districts = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load districts/cities. Please try again.',
        'Branch Location',
      );
    } finally {
      this.loadingDistricts = false;
      this.cdr.detectChanges();
    }
  }

  async submitBranch(): Promise<void> {
    if (!this.formValidationService.validateForm(this.branchForm as any, this.getFieldName, this.el)) {
      return;
    }

    const formValue = this.branchForm.getRawValue();
    const payload = {
      stateCode: Number(formValue.stateCode),
      districtCode: Number(formValue.districtCode),
      branchName: `${formValue.branchName ?? ''}`.trim(),
      branchAddress: `${formValue.branchAddress ?? ''}`.trim(),
      status: Number(formValue.status ?? 1),
    };

    this.isSubmitting = true;

    try {
      this.spinner.show();
      const response = await lastValueFrom(this.administrationService.createBranch(payload));

      if (response.status || response.success) {
        await this.alertHelper.success(response.message || 'Branch added successfully');
        this.resetForm();
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error), 'Add Branch');
    } finally {
      this.isSubmitting = false;
      this.spinner.hide();
      this.cdr.detectChanges();
    }
  }

  getFieldName(field: string): string {
    const map: Record<string, string> = {
      stateCode: 'State',
      districtCode: 'District/City',
      branchName: 'Branch Name',
      branchAddress: 'Branch Address',
      status: 'Status',
    };

    return map[field] || field;
  }

  isInvalid(controlName: string): boolean {
    const control = this.branchForm.get(controlName);

    return !!control && control.touched && control.invalid;
  }

  private resetForm(): void {
    this.branchForm.reset({
      stateCode: '',
      districtCode: '',
      branchName: '',
      branchAddress: '',
      status: '1',
    });
    this.districts = [];
    this.selectedStateCode = '';
    this.branchForm.get('districtCode')?.disable();
    this.cdr.detectChanges();
  }

  private extractErrorMessage(error: any): string {
    const apiError = error?.error;

    if (apiError?.errors && typeof apiError.errors === 'object') {
      const firstFieldErrors = Object.values(apiError.errors)[0];

      if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
        return firstFieldErrors[0];
      }
    }

    return apiError?.message || 'Unable to save branch. Please try again.';
  }
}
