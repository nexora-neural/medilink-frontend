import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../../../core/auth.service';

export interface EmergencyContact {
  name: string;
  phone: string;
}

@Component({
  selector: 'app-emergency-contact-card',
  imports: [ReactiveFormsModule],
  templateUrl: './emergency-contact-card.html',
  styleUrl: './emergency-contact-card.scss',
})
export class EmergencyContactCard {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly contact = input.required<EmergencyContact>();

  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.maxLength(150)],
    phone: ['', Validators.maxLength(32)],
  });

  constructor() {
    effect(() => {
      this.form.reset(this.contact());
      this.error.set('');
      this.message.set('');
    });
  }

  async save(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const response = await this.auth.updateEmergencyContact({
        name: this.form.controls.name.value,
        phone: this.form.controls.phone.value,
      });

      this.form.reset({
        name: response.emergency_contact_name ?? '',
        phone: response.emergency_contact_phone ?? '',
      });

      this.message.set('Emergency contact saved.');
    } catch {
      this.error.set('Your emergency contact could not be saved. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
