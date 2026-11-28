import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PatientSettings } from './patient-settings';
import {
  DEFAULT_PATIENT_NOTIFICATION_PREFERENCES,
  PatientNotificationPreferencesPreviewStore,
} from './patient-notification-preferences-preview.store';

describe('PatientSettings', () => {
  let loadFor: ReturnType<typeof vi.fn>;
  let saveFor: ReturnType<typeof vi.fn>;
  let resetFor: ReturnType<typeof vi.fn>;

  async function setup(
    load = vi.fn().mockResolvedValue({ ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES }),
  ) {
    loadFor = load;
    saveFor = vi.fn().mockResolvedValue(undefined);
    resetFor = vi.fn().mockResolvedValue({ ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES });
    await TestBed.configureTestingModule({
      imports: [PatientSettings],
      providers: [
        provideRouter([]),
        {
          provide: PatientNotificationPreferencesPreviewStore,
          useValue: { loadFor, saveFor, resetFor },
        },
      ],
    }).compileComponents();
    TestBed.inject(ActiveRoleService).setAccountRoles('patient-settings-test', ['patient']);
    const fixture = TestBed.createComponent(PatientSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the browser-only preferences and explains the integration boundary', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('local preview');
    expect(element.textContent).toContain('until ML-207 connects preferences');
    expect(element.textContent).toContain('does not change dose instructions');
    expect(element.textContent).toContain('does not promise push alerts');
    expect(loadFor).toHaveBeenCalledWith('patient-settings-test');
    expect(element.querySelectorAll('[role="switch"]')).toHaveLength(3);
  });

  it('saves a changed preference for the active patient account', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;
    const medication = element.querySelector<HTMLInputElement>(
      'input[aria-label="Medication reminders"]',
    )!;
    medication.checked = false;
    medication.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    const save = element.querySelector<HTMLButtonElement>('.save-button')!;
    expect(save.disabled).toBe(false);
    save.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(saveFor).toHaveBeenCalledWith('patient-settings-test', {
      medication: false,
      reports: true,
      account: true,
    });
    expect(element.textContent).toContain('Preview preferences saved in this browser');
    expect(element.querySelector('.save-button')?.textContent).toContain('Save changes');
  });

  it('discards edits without saving them', async () => {
    const fixture = await setup();
    const page = fixture.componentInstance;
    page.draft.set({ medication: false, reports: true, account: true });
    fixture.detectChanges();

    page.discard();
    fixture.detectChanges();

    expect(page.draft()).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);
    expect(page.dirty()).toBe(false);
    expect(saveFor).not.toHaveBeenCalled();
  });

  it('validates preference values before attempting to save', async () => {
    const fixture = await setup();
    fixture.componentInstance.draft.set({
      medication: 'enabled' as unknown as boolean,
      reports: true,
      account: true,
    });
    fixture.detectChanges();

    await fixture.componentInstance.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Choose a valid on or off value');
    expect(saveFor).not.toHaveBeenCalled();
  });

  it('reports a failed save and exposes a retry action', async () => {
    const fixture = await setup();
    const page = fixture.componentInstance;
    page.draft.set({ medication: false, reports: true, account: true });
    saveFor.mockRejectedValueOnce(new Error('storage unavailable'));

    await page.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Check browser storage and retry');
    expect(fixture.nativeElement.querySelector('.save-button')?.textContent).toContain(
      'Retry save',
    );
  });

  it('shows a load error, retries it, and can restore preview defaults', async () => {
    const failingLoad = vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid storage'))
      .mockResolvedValueOnce({ ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES });
    const fixture = await setup(failingLoad);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Preferences are unavailable');

    const retry = fixture.nativeElement.querySelector('app-ui-state button') as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(loadFor).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('[role="switch"]')).toHaveLength(3);

    const page = fixture.componentInstance;
    page.draft.set({ medication: false, reports: true, account: true });
    resetFor.mockResolvedValueOnce({ ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES });
    await page.restoreDefaults();
    expect(resetFor).toHaveBeenCalledWith('patient-settings-test');
    expect(page.draft()).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);
  });

  it('keeps the settings links and switches keyboard reachable', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;
    const anchor = element.querySelector<HTMLAnchorElement>('a[href="#settings-notifications"]')!;
    const toggle = element.querySelector<HTMLInputElement>('[role="switch"]')!;

    anchor.focus();
    expect(document.activeElement).toBe(anchor);
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-label')).toBe('Medication reminders');
  });
});
