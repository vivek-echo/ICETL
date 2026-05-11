import { Component } from '@angular/core';
import { ApplicationService } from '../../services/application-service';
import { lastValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {

  constructor(private ApplicationService : ApplicationService){
    this.check();
  }
  async check(){
    const response:any = await lastValueFrom(this.ApplicationService.check())
  }

}
