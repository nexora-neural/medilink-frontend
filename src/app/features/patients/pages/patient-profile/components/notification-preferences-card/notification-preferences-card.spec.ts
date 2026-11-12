import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, MeResponse } from '../../../../../../core/auth.service';
import {
  NotificationPreferences,
  NotificationPreferencesCard,
} from './notification-preferences-card';

type Profile = NonNullable<MeResponse['patient_profile']>;

function response(preferences: NotificationPreferences): Profile {
  return {
    user_id: 'demo-patient',
    date_of_birth: '2000-01-01',
    sex: 'female',
    emergency_contact_name: null,
    emergency_contact_phone: null,
    notification_preferences: { ...preferences },
  };
}

describe('NotificationPreferencesCard', () => {
  let fixture: ComponentFixture<NotificationPreferencesCard>;
  let component: NotificationPreferencesCard;

  const auth = {
    updateNotificationPreferences: vi.fn<(input: NotificationPreferences) => Promise<Profile>>(),
  };

  beforeEach(async () => {
    auth.updateNotificationPreferences.mockReset();

    await TestBed.configureTestingModule({
      imports: [NotificationPreferencesCard],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPreferencesCard);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('preferences', {
      medication_in_app: true,
      vaccination_in_app: false,
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('displays saved checkbox values', () => {
    const inputs: NodeListOf<HTMLInputElement> =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]');

    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);
  });

  it('saves both preferences as false', async () => {
    const preferences = {
      medication_in_app: false,
      vaccination_in_app: false,
    };

    component.form.setValue(preferences);
    auth.updateNotificationPreferences.mockResolvedValue(response(preferences));

    await component.save();
    fixture.detectChanges();

    expect(auth.updateNotificationPreferences).toHaveBeenCalledWith(preferences);
    expect(component.form.getRawValue()).toEqual(preferences);
    expect(fixture.nativeElement.textContent).toContain('Notification preferences saved.');
  });

  it('retains choices after failure and allows retrying', async () => {
    const preferences = {
      medication_in_app: false,
      vaccination_in_app: true,
    };

    component.form.setValue(preferences);
    auth.updateNotificationPreferences.mockRejectedValueOnce(new Error('Service unavailable'));

    await component.save();
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual(preferences);
    expect(component.form.enabled).toBe(true);
    expect(component.saving()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Your preferences could not be saved.');

    auth.updateNotificationPreferences.mockResolvedValue(response(preferences));

    await component.save();

    expect(auth.updateNotificationPreferences).toHaveBeenCalledTimes(2);
    expect(component.error()).toBe('');
    expect(component.message()).toBe('Notification preferences saved.');
  });

  it('disables controls and prevents duplicate requests while saving', async () => {
    let finish!: (profile: Profile) => void;

    auth.updateNotificationPreferences.mockImplementation(
      () =>
        new Promise<Profile>((resolve) => {
          finish = resolve;
        }),
    );

    const pendingSave = component.save();
    fixture.detectChanges();

    const inputs: NodeListOf<HTMLInputElement> =
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');

    expect(inputs[0].disabled).toBe(true);
    expect(inputs[1].disabled).toBe(true);
    expect(button.disabled).toBe(true);

    await component.save();

    expect(auth.updateNotificationPreferences).toHaveBeenCalledTimes(1);

    finish(
      response({
        medication_in_app: true,
        vaccination_in_app: false,
      }),
    );

    await pendingSave;
    fixture.detectChanges();

    expect(inputs[0].disabled).toBe(false);
    expect(inputs[1].disabled).toBe(false);
    expect(button.disabled).toBe(false);
  });
});
