import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../../core/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

@Component({
  selector: 'app-access-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './access-form.html',
  styleUrl: './access-form.scss',
})
export class AccessFormComponent implements OnChanges {
  @Input() page = '';
  @Input() role = 'Patient';
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  showPassword = false;
  submitted = false;
  busy = false;
  email = '';
  password = '';
  confirm = '';
  code = '';
  message = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['page']) return;
    this.submitted = false;
    this.message = '';
  }

  async submit(form: NgForm) {
    this.submitted = true;
    if (!form.valid) return;
    if (this.page === 'reset' && this.password !== this.confirm) return;
    if (this.page === 'login') {
      this.busy = true;
      this.message = '';
      try {
        await this.auth.signIn(this.email, this.password);
        await this.router.navigate(['/workspace']);
      } catch (error) {
        this.message =
          error instanceof TimeoutError ||
          (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) ||
          (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'auth/network-request-failed')
            ? 'The service is unavailable. Please try again later.'
            : 'Unable to sign in. Check your account and try again.';
      } finally {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
      return;
    }
    this.busy = true;
    setTimeout(() => {
      this.busy = false;
      if (this.page === 'register') {
        this.router.navigate(['/verify'], { queryParams: { role: this.role } });
      } else if (this.page === 'forgot') {
        this.message = 'Password reset is currently unavailable. No email has been sent.';
      } else if (this.page === 'reset') {
        this.message =
          'Password reset is currently unavailable. Your password has not been changed.';
      } else if (this.page === 'verify') {
        if (this.role !== 'Patient') {
          this.router.navigate(['/verification-documents'], { queryParams: { role: this.role } });
        } else {
          this.message = 'Contact verification is currently unavailable.';
        }
      } else {
        this.message = 'Sign-in is currently unavailable.';
      }
    }, 600);
  }
}
