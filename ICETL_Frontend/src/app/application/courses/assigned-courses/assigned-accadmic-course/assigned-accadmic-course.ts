import { Component } from '@angular/core';
import { AssignedModuleList } from '../assigned-module-list/assigned-module-list';

@Component({
  selector: 'app-assigned-accadmic-course',
  imports: [AssignedModuleList],
  templateUrl: './assigned-accadmic-course.html',
  styleUrl: './assigned-accadmic-course.scss',
})
export class AssignedAccadmicCourse {
}
