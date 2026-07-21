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
  Branch,
  LocationDistrict,
  LocationState,
} from '../../services/administration';

@Component({
  selector: 'app-add-employee',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-employee.html',
  styleUrl: './add-employee.scss',
})
export class AddEmployee {
  readonly defaultPassword = 'ICETL@123';

  states: LocationState[] = [];
  districts: LocationDistrict[] = [];
  branches: Branch[] = [];

  loadingStates = false;
  loadingDistricts = false;
  loadingBranches = false;
  isSubmitting = false;
  selectedStateCode = '';
  selectedDistrictCode = '';

  employeeForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly administrationService: AdministrationService,
    private readonly formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private readonly spinner: NgxSpinnerService,
    private readonly alertHelper: AlertHelperService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.employeeForm = this.fb.group({
      stateCode: ['', Validators.required],
      districtCode: [{ value: '', disabled: true }, Validators.required],
      branchId: [{ value: '', disabled: true }, Validators.required],
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      dob: [''],
      gender: [''],
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
        'Employee Location',
      );
    } finally {
      this.loadingStates = false;
      this.cdr.detectChanges();
    }
  }

  onStateChange(): void {
    this.selectedStateCode = `${this.employeeForm.get('stateCode')?.value ?? ''}`;
    this.selectedDistrictCode = '';
    const stateCode = Number(this.selectedStateCode || 0);
    const districtControl = this.employeeForm.get('districtCode');
    const branchControl = this.employeeForm.get('branchId');

    districtControl?.reset('');
    branchControl?.reset('');
    this.districts = [];
    this.branches = [];
    branchControl?.disable();

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
        'Employee Location',
      );
    } finally {
      this.loadingDistricts = false;
      this.cdr.detectChanges();
    }
  }

  onDistrictChange(): void {
    this.selectedDistrictCode = `${this.employeeForm.get('districtCode')?.value ?? ''}`;
    const stateCode = Number(this.selectedStateCode || 0);
    const districtCode = Number(this.selectedDistrictCode || 0);
    const branchControl = this.employeeForm.get('branchId');

    branchControl?.reset('');
    this.branches = [];

    if (!stateCode || !districtCode) {
      branchControl?.disable();
      this.cdr.detectChanges();
      return;
    }

    branchControl?.enable();
    this.cdr.detectChanges();
    void this.loadBranches(stateCode, districtCode);
  }

  async loadBranches(stateCode: number, districtCode: number): Promise<void> {
    this.loadingBranches = true;
    this.cdr.detectChanges();

    try {
      const response = await lastValueFrom(
        this.administrationService.getBranches({
          page: 1,
          perPage: 'all',
          stateCode,
          districtCode,
          status: '1',
        }),
      );
      this.branches = response.status ? response.data : [];
    } catch (error: any) {
      this.branches = [];
      await this.alertHelper.error(
        error?.error?.message || 'Unable to load branches. Please try again.',
        'Employee Location',
      );
    } finally {
      this.loadingBranches = false;
      this.cdr.detectChanges();
    }
  }

  async submitEmployee(): Promise<void> {
    if (!this.formValidationService.validateForm(this.employeeForm as any, this.getFieldName, this.el)) {
      return;
    }

    const formValue = this.employeeForm.getRawValue();
    const payload = {
      stateCode: Number(formValue.stateCode),
      districtCode: Number(formValue.districtCode),
      branchId: Number(formValue.branchId),
      name: `${formValue.name ?? ''}`.trim(),
      email: `${formValue.email ?? ''}`.trim().toLowerCase(),
      phone: `${formValue.phone ?? ''}`.replace(/\D+/g, ''),
      dob: formValue.dob || null,
      gender: formValue.gender || null,
      status: Number(formValue.status ?? 1),
    };

    this.isSubmitting = true;

    try {
      this.spinner.show();
      const response = await lastValueFrom(this.administrationService.createEmployee(payload));

      if (response.status || response.success) {
        await this.alertHelper.success(
          response.message || 'Employee user added successfully',
          'Add Employee',
        );
        this.resetForm();
      }
    } catch (error: any) {
      await this.alertHelper.error(this.extractErrorMessage(error), 'Add Employee');
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
      branchId: 'Branch',
      name: 'Employee Name',
      email: 'Email',
      phone: 'Phone',
      dob: 'Date of Birth',
      gender: 'Gender',
      status: 'Status',
    };

    return map[field] || field;
  }

  isInvalid(controlName: string): boolean {
    const control = this.employeeForm.get(controlName);

    return !!control && control.touched && control.invalid;
  }

  private resetForm(): void {
    this.employeeForm.reset({
      stateCode: '',
      districtCode: '',
      branchId: '',
      name: '',
      email: '',
      phone: '',
      dob: '',
      gender: '',
      status: '1',
    });
    this.districts = [];
    this.branches = [];
    this.selectedStateCode = '';
    this.selectedDistrictCode = '';
    this.employeeForm.get('districtCode')?.disable();
    this.employeeForm.get('branchId')?.disable();
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

    return apiError?.message || 'Unable to save employee user. Please try again.';
  }
}
