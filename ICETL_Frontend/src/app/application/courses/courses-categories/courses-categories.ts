import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-courses-categories',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './courses-categories.html',
  styleUrl: './courses-categories.scss',
})
export class CoursesCategories {
  private readonly router = inject(Router);

  
}
