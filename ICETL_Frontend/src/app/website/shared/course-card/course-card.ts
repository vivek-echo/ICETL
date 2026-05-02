import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Course } from '../../data/site-content';

@Component({
  selector: 'app-course-card',
  imports: [RouterLink],
  templateUrl: './course-card.html',
  styleUrl: './course-card.scss',
})
export class CourseCardComponent {
  readonly course = input.required<Course>();
  readonly targetRoute = input('/courses');
  readonly stars = [0, 1, 2, 3, 4];
}
