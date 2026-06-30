import { Component, ViewChild } from '@angular/core';
import { ViewMyOfflineCourse } from '../view-my-offline-course/view-my-offline-course';

@Component({
  selector: 'app-view-all-offline-course',
  standalone: true,
  imports: [ViewMyOfflineCourse],
  templateUrl: './view-all-offline-course.html',
  styleUrl: './view-all-offline-course.scss',
})
export class ViewAllOfflineCourse {
  @ViewChild(ViewMyOfflineCourse) private offlineCourseList?: ViewMyOfflineCourse;

  get showFilters(): boolean {
    return this.offlineCourseList?.showFilters ?? false;
  }

  toggleFilters(): void {
    this.offlineCourseList?.toggleFilters();
  }
}
