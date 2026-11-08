import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../../core/auth.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class RegistrationComponent implements OnChanges {
  @Input() page = '';
  @Input() role = 'Patient';
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  showPassword = false;
  private readonly formBuilder = inject(FormBuilder);
  readonly registrationForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    dateOfBirth: [''],
    sex: [''],
    professionalId: ['', Validators.required],
    organization: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    registerConfirm: ['', Validators.required],
  });
  message = '';
  busy = false;
  registerStep = 1;
  registerSubmitted = false;

  get registerSteps(): number {
    return this.role === 'Patient' ? 3 : 4;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['page']) return;
    this.registerStep = 1;
    this.registerSubmitted = false;
    this.message = '';
  }

  async registrationNext(): Promise<void> {
    this.registerSubmitted = true;
    const controls = this.registrationForm.controls;
    const fields =
      this.registerStep === 1
        ? [controls.fullName, controls.email, controls.phone]
        : this.role !== 'Patient' && this.registerStep === 2
          ? [controls.professionalId, controls.organization]
          : this.registerStep === this.registerSteps - 1
            ? [controls.password, controls.registerConfirm]
            : [];
    if (fields.some((field) => field.invalid)) return;
    if (
      this.role === 'Patient' &&
      this.registerStep === 1 &&
      (!controls.dateOfBirth.value || !['female', 'male'].includes(controls.sex.value))
    )
      return;
    if (
      this.registerStep === this.registerSteps - 1 &&
      controls.password.value !== controls.registerConfirm.value
    )
      return;
    if (this.registerStep < this.registerSteps) {
      this.registerStep++;
      this.registerSubmitted = false;
    } else {
      if (this.role !== 'Patient') {
        this.message =
          'Professional registration is currently unavailable. No account has been created.';
        return;
      }
      this.busy = true;
      try {
        await this.auth.registerPatient({
          email: controls.email.value,
          password: controls.password.value,
          displayName: controls.fullName.value,
          phone: controls.phone.value,
          dateOfBirth: controls.dateOfBirth.value,
          sex: controls.sex.value as 'female' | 'male',
        });
        await this.router.navigate(['/workspace']);
      } catch {
        this.message = 'Registration could not be completed. Please try again.';
      } finally {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }
  registrationBack() {
    if (this.registerStep > 1) {
      this.registerStep--;
      this.registerSubmitted = false;
    } else {
      this.router.navigate([this.role === 'Patient' ? '/' : '/professional-registration']);
    }
  }
}
