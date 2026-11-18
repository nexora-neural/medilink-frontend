import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ActiveRole, ActiveRoleService } from '../../../../core/context/active-role.service';
import {
  SAMPLE_ACTIVE_REFERENCE,
  SAMPLE_OTHER_LAB_REFERENCE,
} from '../../data/lab-upload-request.samples';
import { LabRequestResolution } from './lab-request-resolution';

describe('LabRequestResolution preview', () => {
  async function setup(preview = '') {
    const activeRole = signal<ActiveRole>('Lab Staff');

    await TestBed.configureTestingModule({
      imports: [LabRequestResolution],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(preview ? { preview } : {})),
          },
        },
        {
          provide: ActiveRoleService,
          useValue: {
            activeRole: activeRole.asReadonly(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LabRequestResolution);
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance,
      activeRole,
    };
  }

  it('resolves an active request assigned to the sample laboratory', async () => {
    const { page, fixture } = await setup();

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();
    fixture.detectChanges();

    expect(page.error()).toBe('');
    expect(page.resolved()).toEqual({
      reference: SAMPLE_ACTIVE_REFERENCE,
      patientLabel: 'Sample Patient',
      labName: 'Example Central Laboratory',
      expiresAt: expect.any(String),
    });

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Sample request resolved');
    expect(element.textContent).toContain('Sample Patient');
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });

  it('rejects a whitespace-only reference', async () => {
    const { page } = await setup();

    page.referenceControl.setValue('   ');
    page.resolve();

    expect(page.resolved()).toBeNull();
    expect(page.error()).toContain('Enter a sample request reference');
  });

  it('rejects a reference longer than 100 characters', async () => {
    const { page } = await setup();

    page.referenceControl.setValue('x'.repeat(101));
    page.resolve();

    expect(page.resolved()).toBeNull();
    expect(page.error()).toContain('up to 100 characters');
  });

  const unavailableReferences = [
    ['invalid', 'sample_invalid'],
    ['expired', 'sample_8e4a2c7f1b9d6035'],
    ['revoked', 'sample_2a6f9c1e7b4d8035'],
    ['another laboratory', SAMPLE_OTHER_LAB_REFERENCE],
  ] as const;

  for (const [label, reference] of unavailableReferences) {
    it(`hides patient details for a request that is ${label}`, async () => {
      const { page, fixture } = await setup();

      page.referenceControl.setValue(reference);
      page.resolve();
      fixture.detectChanges();

      expect(page.resolved()).toBeNull();
      expect(page.error()).toBe(
        'This sample request is unavailable. It may be invalid, expired, revoked or assigned to another laboratory.',
      );

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('Sample Patient');
      expect(element.textContent).not.toContain('Sample request resolved');
    });
  }

  it('clears resolved details when the reference changes', async () => {
    const { page, fixture } = await setup();

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();
    expect(page.resolved()).not.toBeNull();

    page.referenceControl.setValue('sample_invalid');
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Sample Patient');
  });

  it('hides resolved details after the request expires', async () => {
    const { page, fixture } = await setup();

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();

    const resolved = page.resolved();
    expect(resolved).not.toBeNull();

    page.currentTime.set(Date.parse(resolved!.expiresAt));
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Sample Patient');
  });

  it('does not resolve sample references in the empty preview', async () => {
    const { page } = await setup('empty');

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();

    expect(page.resolved()).toBeNull();
    expect(page.error()).toContain('This sample request is unavailable');
  });

  for (const preview of ['loading', 'error', 'denied']) {
    it(`hides the form and blocks resolution in ${preview}`, async () => {
      const { page, fixture } = await setup(preview);

      page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
      page.resolve();
      fixture.detectChanges();

      expect(page.canResolve()).toBe(false);
      expect(page.resolved()).toBeNull();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('form')).toBeNull();
      expect(element.textContent).not.toContain('Sample Patient');
    });
  }

  it('restores lookup after retrying an error preview', async () => {
    const { page, fixture } = await setup('error');

    page.retry();
    fixture.detectChanges();

    expect(page.pageState()).toBe('ready');

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();

    expect(page.resolved()).not.toBeNull();
  });

  it('hides patient details and blocks lookup after the role changes', async () => {
    const { page, fixture, activeRole } = await setup();

    page.referenceControl.setValue(SAMPLE_ACTIVE_REFERENCE);
    page.resolve();
    expect(page.resolved()).not.toBeNull();

    activeRole.set('Patient');
    fixture.detectChanges();

    expect(page.resolved()).toBeNull();

    page.resolve();
    fixture.detectChanges();

    expect(page.canResolve()).toBe(false);
    expect(page.resolved()).toBeNull();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).not.toContain('Sample Patient');
  });
});
