import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEATURED_COURSES } from '../../data/site-content';
import { CourseCardComponent } from '../../shared/course-card/course-card';

@Component({
  selector: 'app-courses',
  imports: [RouterLink, CourseCardComponent],
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
})
export class CoursesComponent {
  readonly courses = FEATURED_COURSES;
  readonly selectedCategory = signal('All');
  readonly categories = ['All', ...new Set(FEATURED_COURSES.map((course) => course.category))];

  readonly filteredCourses = computed(() => {
    if (this.selectedCategory() === 'All') {
      return this.courses;
    }

    return this.courses.filter((course) => course.category === this.selectedCategory());
  });

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }
}
