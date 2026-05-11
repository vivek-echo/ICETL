import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgxSpinnerComponent } from 'ngx-spinner';
import { GLOBAL_SPINNER_NAME } from './spinner.tokens';

@Component({
  selector: 'app-global-spinner',
  imports: [NgxSpinnerComponent],
  templateUrl: './global-spinner.component.html',
  styleUrl: './global-spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalSpinnerComponent {
  protected readonly spinnerName = GLOBAL_SPINNER_NAME;
}
