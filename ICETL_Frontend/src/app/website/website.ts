import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header';
import { FooterComponent } from './layout/footer/footer';

@Component({
  selector: 'app-website',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './website.html',
  styleUrl: './website.scss',
})
export class WebsiteComponent {
}
