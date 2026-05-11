import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-add-courses',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-courses.html',
  styleUrl: './add-courses.scss',
})
export class AddCourses {
  courseForm: FormGroup;

  previewImage: string = 'https://placehold.co/710x488';

  categories = ['Languages', 'Web Development', 'UI/UX Design', 'Mobile Development', 'Marketing'];

  constructor(private fb: FormBuilder) {
    this.courseForm = this.fb.group({
      title: ['React Front To Back'],

      category: ['Languages'],

      instructor: ['Patrick'],

      price: [60],

      oldPrice: [120],

      lessons: [20],

      students: [40],

      description: ['React Js long fact that a reader will be distracted by the readable.'],

      status: ['Published'],

      featured: ['Yes'],
    });
  }

  /**
   * Thumbnail Preview
   */
  onThumbnailChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || !input.files.length) {
      return;
    }

    const file = input.files[0];

    const reader = new FileReader();

    reader.onload = () => {
      this.previewImage = reader.result as string;
    };

    reader.readAsDataURL(file);
  }

  submitCourse(): void {
    console.log(this.courseForm.value);
  }
}
