import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  readonly countryDialCode = '+94';
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly maxBirthDate = (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  })();

  showPassword = false;
  private readonly formBuilder = inject(FormBuilder);
  readonly registrationForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
    dateOfBirth: [
      '',
      [
        Validators.required,
        (control: AbstractControl) => {
          const value = control.value as string;
          if (!value) return null;
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
          if (!match) return { invalidDate: true };
          const [, year, month, day] = match;
          const parsed = new Date(Number(year), Number(month) - 1, Number(day));
          const valid =
            parsed.getFullYear() === Number(year) &&
            parsed.getMonth() === Number(month) - 1 &&
            parsed.getDate() === Number(day) &&
            value <= this.maxBirthDate;
          return valid ? null : { invalidDate: true };
        },
      ],
    ],
    sex: [''],
    professionalId: ['', Validators.required],
    organization: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    registerConfirm: ['', Validators.required],
  });

  constructor() {
    this.registrationForm.controls.phone.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.resetAvailability('phone');
        const limited = this.normalizePhone(value);
        if (limited !== value) {
          this.registrationForm.controls.phone.setValue(limited, { emitEvent: false });
        }
      });
  }

  message = '';
  busy = false;
  registerStep = 1;
  registerSubmitted = false;
  checking: Record<'email' | 'phone', boolean> = { email: false, phone: false };
  availabilityMessage: Record<'email' | 'phone', string> = { email: '', phone: '' };
  private checkSequence: Record<'email' | 'phone', number> = { email: 0, phone: 0 };
  recoverExisting = false;

  resetAvailability(field: 'email' | 'phone'): void {
    if (field === 'email') this.recoverExisting = false;
    this.checkSequence[field]++;
    this.checking[field] = false;
    this.availabilityMessage[field] = '';
  }

  private normalizePhone(value: string): string {
    return value.replace(/\D/g, '').slice(0, 9);
  }

  async checkAvailability(field: 'email' | 'phone'): Promise<boolean> {
    const control = this.registrationForm.controls[field];
    if (control.invalid) return false;
    const sequence = ++this.checkSequence[field];
    const value =
      field === 'phone' ? `${this.countryDialCode}${control.value.trim()}` : control.value.trim();
    this.checking[field] = true;
    this.availabilityMessage[field] = '';
    try {
      const result = await this.auth.registrationAvailable(field, value);
      if (sequence !== this.checkSequence[field]) return false;
      if (field === 'email') this.recoverExisting = result.recoverable;
      this.availabilityMessage[field] = result.recoverable
        ? 'This email has an incomplete account. Use its existing password to finish registration.'
        : result.available
          ? ''
          : `This ${field === 'phone' ? 'mobile number' : 'email address'} is already registered.`;
      return result.available || result.recoverable;
    } catch {
      if (sequence === this.checkSequence[field])
        this.availabilityMessage[field] = 'Could not check availability. Please try again.';
      return false;
    } finally {
      if (sequence === this.checkSequence[field]) this.checking[field] = false;
      this.changeDetector.markForCheck();
    }
  }

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
      (controls.dateOfBirth.invalid || !['female', 'male'].includes(controls.sex.value))
    )
      return;
    if (this.registerStep === 1) {
      const results = await Promise.all([
        this.checkAvailability('email'),
        this.checkAvailability('phone'),
      ]);
      if (results.some((available) => !available)) return;
    }
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
          phone: `${this.countryDialCode}${controls.phone.value}`,
          dateOfBirth: controls.dateOfBirth.value,
          sex: controls.sex.value as 'female' | 'male',
          recoverExisting: this.recoverExisting,
        });
        await this.router.navigate(['/workspace']);
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
        this.message =
          code === 'auth/email-already-in-use'
            ? 'This email address is already registered. Please log in.'
            : 'Registration could not be completed. Please try again.';
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
