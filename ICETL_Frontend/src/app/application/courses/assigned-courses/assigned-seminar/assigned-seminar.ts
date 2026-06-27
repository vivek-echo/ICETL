import { Component } from '@angular/core';
import { AssignedModuleList } from '../assigned-module-list/assigned-module-list';

@Component({
  selector: 'app-assigned-seminar',
  imports: [AssignedModuleList],
  templateUrl: './assigned-seminar.html',
  styleUrl: './assigned-seminar.scss',
})
export class AssignedSeminar {
}
