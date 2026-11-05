import { Component, effect, input, output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PatientDetails } from '../../patient-profile';

@Component({
  selector: 'app-personal-information-card',
  imports: [ReactiveFormsModule],
  templateUrl: './personal-information-card.html',
  styleUrl: './personal-information-card.scss',
})
export class PersonalInformationCard {
  private readonly fb = inject(FormBuilder);

  readonly profile = input.required<PatientDetails>();
  readonly isEditing = input(false);

  readonly editRequested = output<void>();
  readonly saveRequested = output<PatientDetails>();
  readonly cancelRequested = output<void>();

  submitted = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const patient = this.profile();

      this.form.patchValue(patient, {
        emitEvent: false,
      });
    });
  }

  save(): void {
    this.submitted = true;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saveRequested.emit({
      name: this.form.controls.name.value.trim(),
      email: this.form.controls.email.value.trim(),
      phone: this.form.controls.phone.value.trim(),
    });

    this.submitted = false;
  }

  cancel(): void {
    this.form.reset(this.profile());
    this.submitted = false;
    this.cancelRequested.emit();
  }
}
