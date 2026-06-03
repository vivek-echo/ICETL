import { Component } from '@angular/core';
import { ViewMyOfflineCourse } from '../view-my-offline-course/view-my-offline-course';

@Component({
  selector: 'app-view-all-offline-course',
  standalone: true,
  imports: [ViewMyOfflineCourse],
  templateUrl: './view-all-offline-course.html',
  styleUrl: './view-all-offline-course.scss',
})
export class ViewAllOfflineCourse {}
