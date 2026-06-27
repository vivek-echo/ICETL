import { Component } from '@angular/core';
import { AssignedModuleList } from '../assigned-module-list/assigned-module-list';

@Component({
  selector: 'app-assigned-workshop',
  imports: [AssignedModuleList],
  templateUrl: './assigned-workshop.html',
  styleUrl: './assigned-workshop.scss',
})
export class AssignedWorkshop {
}
