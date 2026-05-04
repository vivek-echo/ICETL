import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

@Injectable({
  providedIn: 'root'
})
export class AlertHelperService {
  viewAlert(icon: AlertIcon, title: string, message: string) {
    return Swal.fire({
      ...this.getBaseOptions(),
      icon,
      title,
      text: message,
      confirmButtonColor: this.getConfirmButtonColor(icon)
    });
  }

  viewAlertHtml(icon: AlertIcon, title: string, html: string) {
    return Swal.fire({
      ...this.getBaseOptions(),
      icon,
      title,
      html,
      confirmButtonColor: this.getConfirmButtonColor(icon)
    });
  }

  // Success Alert
  success(message: string, title: string = 'Success') {
    return this.viewAlert('success', title, message);
  }

  // Error Alert
  error(message: string, title: string = 'Error') {
    return this.viewAlert('error', title, message);
  }

  // Warning Alert
  warning(message: string, title: string = 'Warning') {
    return this.viewAlert('warning', title, message);
  }

  // Info Alert
  info(message: string, title: string = 'Info') {
    return this.viewAlert('info', title, message);
  }

  // Confirm Dialog
  confirm(message: string, title: string = 'Are you sure?'): Promise<boolean> {
    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'question',
      title: title,
      text: message,
      showCancelButton: true,
      confirmButtonColor: '#5E35B1',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel'
    }).then(result => result.isConfirmed);
  }

  // Loading
  loading(message: string = 'Please wait...') {
    Swal.fire({
      ...this.getBaseOptions(),
      title: message,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  // Close loading
  close() {
    Swal.close();
  }

  private getBaseOptions() {
    return {
      width: '36rem',
      padding: '2rem',
      customClass: {
        popup: 'app-alert-popup',
        title: 'app-alert-title',
        htmlContainer: 'app-alert-content'
      }
    };
  }

  private getConfirmButtonColor(icon: AlertIcon): string {
    const colors = {
      success: '#5E35B1',
      error: '#d33',
      warning: '#f57c00',
      info: '#0288d1',
      question: '#5E35B1'
    };

    return colors[icon];
  }
}
