import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../layout/header/header';
import { FooterComponent } from '../layout/footer/footer';

@Component({
  selector: 'app-application',
  imports: [RouterOutlet,HeaderComponent,FooterComponent],
  templateUrl: './application.html',
  styleUrl: './application.scss',
})
export class Application {

}
