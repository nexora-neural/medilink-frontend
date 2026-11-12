import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../../../../core/auth.service';

export interface NotificationPreferences {
  medication_in_app: boolean;
  vaccination_in_app: boolean;
}

@Component({
  selector: 'app-notification-preferences-card',
  imports: [ReactiveFormsModule],
  templateUrl: './notification-preferences-card.html',
  styleUrl: './notification-preferences-card.scss',
})
export class NotificationPreferencesCard {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly preferences = input.required<NotificationPreferences>();

  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly form = this.fb.nonNullable.group({
    medication_in_app: false,
    vaccination_in_app: false,
  });

  constructor() {
    effect(() => {
      this.form.reset(this.preferences());
      this.error.set('');
      this.message.set('');
    });
  }

  async save(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    // Disable checkboxes while the request is pending.
    this.form.disable({ emitEvent: false });

    try {
      const response = await this.auth.updateNotificationPreferences(this.form.getRawValue());

      this.form.reset({
        medication_in_app:
          response.notification_preferences['medication_in_app'] ??
          this.form.controls.medication_in_app.value,
        vaccination_in_app:
          response.notification_preferences['vaccination_in_app'] ??
          this.form.controls.vaccination_in_app.value,
      });

      this.message.set('Notification preferences saved.');
    } catch {
      this.error.set('Your preferences could not be saved. Please try again.');
    } finally {
      this.form.enable({ emitEvent: false });
      this.saving.set(false);
    }
  }
}
