import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { lastValueFrom } from 'rxjs';
import { Course } from '../../services/course';
import { ChangeDetectorRef } from '@angular/core';
import { ROLE } from '../../../../commonServices/constants.service';
import { FormValidationService } from '../../../../commonServices/form-validation-service';
import { AlertHelperService } from '../../../../commonServices/alert-helper-service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-add-courses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgMultiSelectDropDownModule],
  templateUrl: './add-courses.html',
  styleUrl: './add-courses.scss',
})
export class AddCourses implements OnInit {
  courseForm!: FormGroup;

  categories: any[] = [];
  instructorList: any[] = [];

  previewImage = 'https://placehold.co/710x488';

  userProfile: any = localStorage.getItem('auth_user')
    ? JSON.parse(localStorage.getItem('auth_user') || '{}')
    : null;

  dropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'Unselect All',
    allowSearchFilter: true,
  };

  constructor(
    private fb: FormBuilder,
    private courseService: Course,
    private cdr: ChangeDetectorRef,
    private formValidationService: FormValidationService,
    private readonly el: ElementRef,
    private spinner: NgxSpinnerService,
    private alertHelper: AlertHelperService,
  ) {
    this.courseForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      category: ['', Validators.required],
      instructor: [[], Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      oldPrice: [0, [Validators.min(0)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(100)]],
      thumbnail: [null],
      status: [0],
    });
  }

  ngOnInit(): void {
    this.getCourseCategories();
    this.getInstructorList();
  }

  get f() {
    return this.courseForm.controls;
  }

  get discountPercentage() {
    let price = this.f['price'].value || 0;
    let oldPrice = this.f['oldPrice'].value || 0;

    if (!price || !oldPrice) return 0;

    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  get selectedCategory() {
    return (
      this.categories.find((x) => x.id == this.f['category'].value)?.categoryName || 'Category'
    );
  }

  get instructorNames() {
    return this.f['instructor'].value?.map((x: any) => x.name).join(', ') || 'Instructor';
  }

  async getCourseCategories() {
    const response: any = await lastValueFrom(
      this.courseService.getCourseCategories({
        status: '1',
      }),
    );

    if (response.status) {
      this.categories = [...response.data];

      this.cdr.detectChanges(); // important
    }
  }

  async getInstructorList() {
    let payload: any = {
      instructorId: '',
    };

    if (this.userProfile?.role === ROLE.INSTRUCTOR) {
      payload.instructorId = this.userProfile.id;
    }

    const response: any = await lastValueFrom(
      this.courseService.getInstructorListByInstructorId(payload),
    );

    if (response.status) {
      this.instructorList = [...response.data];

      this.cdr.detectChanges(); // important
    }
  }

  onThumbnailChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    // Save file in form
    this.courseForm.patchValue({
      thumbnail: file,
    });

    const reader = new FileReader();

    reader.onload = () => {
      this.previewImage = reader.result as string;

      // Force UI refresh
      this.cdr.detectChanges();
    };

    reader.readAsDataURL(file);
  }

  async submitCourse(): Promise<void> {
    try {
      if (!this.formValidationService.validateForm(this.courseForm, this.getFieldName, this.el)) {
        return;
      }

      // Confirmation popup
      const confirmed = await this.alertHelper.confirm(
        'Do you want to create this course?',
        'Create Course',
      );

      if (!confirmed) {
        return;
      }

      this.spinner.show();

      const formData = new FormData();

      Object.keys(this.courseForm.value).forEach((key) => {
        let value = this.courseForm.value[key];

        // Convert instructor object array -> ID array
        if (key === 'instructor') {
          value = JSON.stringify(value.map((item: any) => item.id));
        }

        // Skip null/empty
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      const response: any = await lastValueFrom(this.courseService.createCourse(formData));

      if (response.status) {
        this.alertHelper.success('Course created successfully!');

        this.courseForm.reset({
          status: 0,
          title:'',
          category: '',
          instructor: [],
          price: 0,
          oldPrice: 0,
          description: '',
          thumbnail: null,
        });

        this.previewImage = 'https://placehold.co/710x488';
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      this.spinner.hide();
    }
  }

  getFieldName(field: string): string {
    const map: Record<string, string> = {
      title: 'Course Title',
      category: 'Course Category',
      instructor: 'Instructor',
      price: 'Price',
      oldPrice: 'Old Price',
      description: 'Course Description',
      thumbnail: 'Course Thumbnail',
      status: 'Status',
    };

    return map[field] || field;
  }
}
