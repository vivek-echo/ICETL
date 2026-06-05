import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-courses.html',
  styleUrl: './add-courses.scss',
})
export class AddCourses implements OnInit {
  courseForm!: FormGroup;

  categories: any[] = [];
  instructorList: any[] = [];
  instructorSearchTerm = '';
  isInstructorPickerOpen = false;

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
      duration: [1, [Validators.required, Validators.min(1)]],
      durationUnit: [1, Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      oldPrice: [0, [Validators.min(0)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
      courseHighlights: this.fb.array([this.fb.control('')]),
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

  get selectedInstructors(): any[] {
    return this.f['instructor'].value || [];
  }

  get instructorPickerLabel(): string {
    const selected = this.selectedInstructors;

    if (!selected.length) {
      return 'Select instructor';
    }

    if (selected.length === 1) {
      return selected[0].name;
    }

    return `${selected.length} instructors selected`;
  }

  get filteredInstructorList(): any[] {
    const term = this.instructorSearchTerm.trim().toLowerCase();

    if (!term) {
      return this.instructorList;
    }

    return this.instructorList.filter((instructor: any) =>
      `${instructor.name || ''}`.toLowerCase().includes(term),
    );
  }

  @HostListener('document:click', ['$event'])
  closeInstructorPickerOnOutsideClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isInstructorPickerOpen = false;
    }
  }

  toggleInstructorPicker(): void {
    this.isInstructorPickerOpen = !this.isInstructorPickerOpen;
  }

  setInstructorSearch(event: Event): void {
    this.instructorSearchTerm = (event.target as HTMLInputElement).value;
  }

  clearInstructorSearch(): void {
    this.instructorSearchTerm = '';
  }

  isInstructorSelected(instructor: any): boolean {
    return (this.f['instructor'].value || []).some((item: any) => item.id === instructor.id);
  }

  toggleInstructor(instructor: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selectedInstructors = [...(this.f['instructor'].value || [])];

    this.courseForm.patchValue({
      instructor: checked
        ? [...selectedInstructors, instructor]
        : selectedInstructors.filter((item: any) => item.id !== instructor.id),
    });

    this.f['instructor'].markAsTouched();
  }

  getHighlights(): FormArray<FormControl<string | null>> {
    return this.courseForm.get('courseHighlights') as FormArray<FormControl<string | null>>;
  }

  addHighlight(): void {
    this.getHighlights().push(this.fb.control(''));
  }

  removeHighlight(index: number): void {
    const highlights = this.getHighlights();

    if (highlights.length <= 1) {
      highlights.at(0).setValue('');
      return;
    }

    highlights.removeAt(index);
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

        if (key === 'courseHighlights') {
          value = JSON.stringify(
            (value || [])
              .map((item: string) => `${item}`.trim())
              .filter((item: string) => item.length > 0),
          );
        }

        // Skip null/empty
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      const response: any = await lastValueFrom(this.courseService.createCourse(formData));

      if (response.status) {
        const courseCode = response.data?.code ? `\nCode: ${response.data.code}` : '';
        this.alertHelper.success(`Course created successfully!${courseCode}`);

        this.courseForm.reset({
          status: 0,
          title:'',
          category: '',
          instructor: [],
          duration: 1,
          durationUnit: 1,
          price: 0,
          oldPrice: 0,
          description: '',
          courseHighlights: [''],
          thumbnail: null,
        });
        this.getHighlights().clear();
        this.addHighlight();

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
      duration: 'Course Duration',
      durationUnit: 'Duration Unit',
      price: 'Price',
      oldPrice: 'Old Price',
      description: 'Course Description',
      courseHighlights: "What You'll Learn",
      thumbnail: 'Course Thumbnail',
      status: 'Status',
    };

    return map[field] || field;
  }
}
