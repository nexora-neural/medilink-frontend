import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import { ClinicalRecords } from './clinical-records';

describe('ClinicalRecords preview', () => {
  async function setup(audience: 'patient' | 'doctor' = 'patient', preview = '') {
    const activeRole = signal<ActiveRole>(audience === 'patient' ? 'Patient' : 'Doctor');
    const params = new BehaviorSubject(convertToParamMap(preview ? { preview } : {}));

    await TestBed.configureTestingModule({
      imports: [ClinicalRecords],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { audience } },
            queryParamMap: params.asObservable(),
          },
        },
        {
          provide: ActiveRoleService,
          useValue: { activeRole: activeRole.asReadonly() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ClinicalRecords);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      activeRole,
      params,
    };
  }

  it('renders fictional records with source and author metadata', async () => {
    const { fixture, page } = await setup();

    expect(page.visibleEntries()).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('.entry-card')).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('Sample preview only');
    expect(fixture.nativeElement.textContent).toContain('Doctor-entered');
    expect(fixture.nativeElement.textContent).toContain('Patient-reported');
    expect(fixture.nativeElement.textContent).toContain('Dr. Sample Silva');
    expect(fixture.nativeElement.textContent).toContain('Example Care Clinic');
  });

  it.each(['patient', 'doctor'] as const)(
    'links the %s records workflow to corrections',
    async (audience) => {
      const { fixture } = await setup(audience);
      const path =
        audience === 'patient' ? 'patient/correction-request' : 'doctor/correction-requests';
      const link = fixture.nativeElement.querySelector('a[href="/workspace/' + path + '"]');
      expect(link).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          'a[href="/workspace/' + audience + '/correction-history"]',
        ),
      ).not.toBeNull();
    },
  );

  it('rejects a whitespace-only title', async () => {
    const { page } = await setup();

    page.openForm();
    page.form.controls.title.setValue('   ');
    page.save();

    expect(page.entries()).toHaveLength(4);
    expect(page.formError()).not.toBe('');
    expect(page.formOpen()).toBe(true);
  });

  it('rejects a future recorded time', async () => {
    const { page } = await setup();

    page.openForm();
    page.form.patchValue({
      title: 'Sample condition',
      recordedAt: '2999-01-01T12:00',
    });
    page.save();

    expect(page.entries()).toHaveLength(4);
    expect(page.formError()).toContain('not in the future');
  });

  it('blocks doctor-only entry types in the patient workspace', async () => {
    const { page } = await setup();

    page.openForm();
    page.form.patchValue({
      kind: 'diagnosis',
      title: 'Invalid patient entry',
    });
    page.save();

    expect(page.entries()).toHaveLength(4);
    expect(page.formError()).toContain('not available');
  });

  it('adds a doctor note without changing existing authors or records', async () => {
    const { page } = await setup('doctor');
    const original = page.entries().map((entry) => ({ ...entry }));

    page.openForm();
    page.form.patchValue({
      kind: 'note',
      title: '  Sample doctor note  ',
    });
    page.save();

    expect(page.entries()).toHaveLength(5);
    expect(page.entries()[0]).toMatchObject({
      kind: 'note',
      title: 'Sample doctor note',
      source: 'doctor',
      authorName: 'Dr. Sample Silva',
      organization: 'Example Care Clinic',
    });
    expect(page.entries().slice(1)).toEqual(original);
  });

  it('adds only the new entry when starting from an empty preview', async () => {
    const { page } = await setup('patient', 'empty');

    expect(page.visibleEntries()).toHaveLength(0);

    page.openForm();
    page.form.controls.title.setValue('Sample condition');
    page.save();

    expect(page.visibleEntries()).toHaveLength(1);
    expect(page.visibleEntries()[0].title).toBe('Sample condition');
    expect(page.allergyStatus()).toBe('unknown');
  });

  it('keeps unknown distinct from no known allergies', async () => {
    const { page, fixture } = await setup('patient', 'empty');

    page.openForm();
    page.form.controls.title.setValue('Sample condition');
    page.save();

    page.setAllergyStatus('no-known-allergies');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No known allergies reported.');

    page.setAllergyStatus('unknown');
    fixture.detectChanges();

    expect(page.allergyStatus()).toBe('unknown');
    expect(fixture.nativeElement.textContent).toContain(
      'allergy information has not been established',
    );
  });

  it('does not replace an active allergy with no known allergies', async () => {
    const { page } = await setup();

    page.setAllergyStatus('no-known-allergies');

    expect(page.allergyStatus()).toBe('allergies-recorded');
    expect(page.message()).toContain('active sample allergy');
  });

  for (const state of ['loading', 'error', 'denied']) {
    it(`hides records and blocks additions in the ${state} preview`, async () => {
      const { page, fixture } = await setup('patient', state);

      page.openForm();
      fixture.detectChanges();

      expect(page.visibleEntries()).toHaveLength(0);
      expect(page.formOpen()).toBe(false);
      expect(fixture.nativeElement.querySelector('.entry-card')).toBeNull();
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      expect(fixture.nativeElement.querySelector('.page-heading button')).toBeNull();
    });
  }

  it('restores records after retrying an error preview', async () => {
    const { page } = await setup('patient', 'error');

    page.retry();

    expect(page.pageState()).toBe('ready');
    expect(page.visibleEntries()).toHaveLength(4);
  });

  it('blocks saving and hides records after the role changes', async () => {
    const { page, activeRole, fixture } = await setup('doctor');

    page.openForm();
    page.form.controls.title.setValue('Sample note');
    activeRole.set('Patient');
    page.save();
    fixture.detectChanges();

    expect(page.entries()).toHaveLength(4);
    expect(page.visibleEntries()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Access unavailable');
  });

  it('starts with fresh sample records when reopened', async () => {
    const { page, fixture } = await setup();

    page.openForm();
    page.form.controls.title.setValue('Temporary condition');
    page.save();

    expect(page.entries()).toHaveLength(5);
    fixture.destroy();

    const reopened = TestBed.createComponent(ClinicalRecords);
    reopened.detectChanges();

    expect(reopened.componentInstance.entries()).toHaveLength(4);
    expect(
      reopened.componentInstance.entries().some((entry) => entry.title === 'Temporary condition'),
    ).toBe(false);

    reopened.destroy();
  });
  it('allows no known allergies with no clinical entries', async () => {
    const { page, fixture } = await setup('patient', 'empty');

    expect(page.visibleEntries()).toHaveLength(0);
    expect(page.allergyStatus()).toBe('unknown');

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];

    const reportButton = buttons.find((button) =>
      button.textContent?.includes('Report no known allergies'),
    );

    expect(reportButton).toBeDefined();
    reportButton!.click();
    fixture.detectChanges();

    expect(page.allergyStatus()).toBe('no-known-allergies');
    expect(page.visibleEntries()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No known allergies reported.');

    page.openForm();
    page.form.controls.title.setValue('Sample condition');
    page.save();

    expect(page.visibleEntries()).toHaveLength(1);
    expect(page.allergyStatus()).toBe('no-known-allergies');
  });
});
