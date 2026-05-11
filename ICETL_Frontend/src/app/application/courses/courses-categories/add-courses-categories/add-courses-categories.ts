import { Component, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { NgxSpinnerService } from 'ngx-spinner';
import { lastValueFrom } from 'rxjs';
import { Course } from '../../services/course';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
@Component({
  selector: 'app-add-courses-categories',
  imports: [ReactiveFormsModule],
  templateUrl: './add-courses-categories.html',
  styleUrl: './add-courses-categories.scss',
})
export class AddCoursesCategories implements OnDestroy {
  categoryForm!: FormGroup;

  selectedFile: File | null = null;

  iconPreview: string | null = null;

  private previewObjectUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private spinner: NgxSpinnerService,
    private courseService: Course,
    private alertHelper: AlertHelperService,
  ) {
    this.categoryForm = this.fb.group({
      categoryName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^[a-zA-Z\s]+$/),
        ],
      ],
      status: ['1', Validators.required],
      icon: [null],
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      this.clearPreview();
      return;
    }

    const file = input.files[0];

    this.selectedFile = file;

    this.categoryForm.patchValue({
      icon: file,
    });

    this.clearPreview(false);
    this.previewObjectUrl = URL.createObjectURL(file);
    this.iconPreview = this.previewObjectUrl;
  }

  async submitCategory():Promise<void> {
    if (!this.formValidationService.validateForm(this.categoryForm, this.getFieldName, this.el)) {
      return;
    }

    const formData = new FormData();
    formData.append('categoryName', this.categoryForm.value.categoryName);
    formData.append('status', this.categoryForm.value.status);
    if (this.selectedFile) {
      formData.append('icon', this.selectedFile);
    }

    try{
      this.spinner.show();
      const response :any = await lastValueFrom(this.courseService.addCourseCategory(formData));
      if(response.success){
        this.alertHelper.success('Course category added successfully!');
        this.categoryForm.reset({ status: '1' });
        this.clearPreview();
      }
    }catch(error){
      console.error('Error submitting form', error);
    }finally{
      this.spinner.hide();
    }

    // API Call Here
    // this.http.post('API_URL', formData).subscribe(...)
  }

  getFieldName(field: string): string {
    const map: Record<string, string> = {
      categoryName: 'Category Name',
      status: 'Status',
      icon: 'Category Icon',
    };

    return map[field] || field;
  }

  ngOnDestroy(): void {
    this.clearPreview(false);
  }

  private clearPreview(resetSelectedFile: boolean = true): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }

    this.iconPreview = null;

    if (resetSelectedFile) {
      this.selectedFile = null;
      this.categoryForm.patchValue({
        icon: null,
      });
    }
  }
}
