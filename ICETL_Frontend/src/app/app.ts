import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiService } from './services/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ICETL_Frontend');
  rolesList: any;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadRolesList();
  }

  loadRolesList() {
    this.api.getRolesList().subscribe({
      next: (res) => {
        console.log('Roles List:', res);
        // this.rolesList = res;
      },
      error: (err) => {
        console.error('Error:', err);
      }
    });
  }
}
