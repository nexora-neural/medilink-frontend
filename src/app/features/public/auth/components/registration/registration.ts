import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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

  showPassword = false;
  private readonly formBuilder = inject(FormBuilder);
  readonly registrationForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    professionalId: ['', Validators.required],
    organization: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    registerConfirm: ['', Validators.required],
  });
  message = '';
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

  registrationNext(): void {
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
      this.registerStep === this.registerSteps - 1 &&
      controls.password.value !== controls.registerConfirm.value
    )
      return;
    if (this.registerStep < this.registerSteps) {
      this.registerStep++;
      this.registerSubmitted = false;
    } else {
      this.message = 'Registration is currently unavailable. No account has been created.';
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
