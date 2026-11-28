import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ActiveRoleService } from '../../core/context/active-role.service';
import { PrescriptionDetail } from './pages/prescription-detail/prescription-detail';
import { PrescriptionEditor } from './pages/prescription-editor/prescription-editor';
import { PrescriptionList } from './pages/prescription-list/prescription-list';
import { PRESCRIPTION_ROUTES } from './prescription.routes';
import { PrescriptionDraftPreviewStore } from './services/prescription-draft-preview.store';

@Component({
  standalone: true,
  template: '<h1>Access denied</h1>',
})
class AccessDeniedStub {}

describe('Prescription preview routing', () => {
  let harness: RouterTestingHarness;
  let roles: ActiveRoleService;

  const base = '/workspace/doctor/prescriptions';

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'workspace/doctor/prescriptions',
            children: PRESCRIPTION_ROUTES,
          },
          {
            path: 'access-denied',
            component: AccessDeniedStub,
          },
        ]),
      ],
    });

    roles = TestBed.inject(ActiveRoleService);
    roles.setAccountRoles('sample-account', ['doctor', 'patient']);
    roles.setActiveRole('Doctor');

    harness = await RouterTestingHarness.create();
  });

  it('opens the list and shows the sample prescriptions', async () => {
    await harness.navigateByUrl(base, PrescriptionList);

    expect(text()).toContain('Sample patient A');
    expect(text()).toContain('Sample patient B');
    expect(text()).toContain('Sample patient C');
    expect(text()).toContain('5 prescription(s) shown');
    expect(text()).toContain('sample-superseded-01');
    expect(text()).toContain('sample-replacement-01');
  });

  it('searches the list by patient reference', async () => {
    await harness.navigateByUrl(base, PrescriptionList);

    const input =
      harness.routeNativeElement!.querySelector<HTMLInputElement>('#prescription-search')!;

    input.value = 'DEMO-P002';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();

    expect(text()).toContain('Sample patient B');
    expect(text()).not.toContain('Sample patient A');
    expect(text()).not.toContain('Sample patient C');
  });

  it('filters the list to active prescriptions', async () => {
    await harness.navigateByUrl(base, PrescriptionList);

    const select =
      harness.routeNativeElement!.querySelector<HTMLSelectElement>('#prescription-status')!;

    select.value = 'active';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    harness.detectChanges();

    expect(text()).toContain('Sample patient B');
    expect(text()).not.toContain('Sample patient A');
    expect(text()).not.toContain('Sample patient C');
  });

  it('opens a prescription directly with all medicine details', async () => {
    await harness.navigateByUrl(`${base}/sample-draft-01`, PrescriptionDetail);

    expect(text()).toContain('Sample patient A');
    expect(text()).toContain('Sample medicine A');
    expect(text()).toContain('Sample medicine B');
    expect(text()).toContain('Sample dose A');
    expect(text()).toContain('Sample frequency A');
  });

  it('retains saved edits when navigating between editor, detail and list', async () => {
    const editor = await harness.navigateByUrl(`${base}/sample-draft-01/edit`, PrescriptionEditor);

    editor.items
      .at(0)
      .controls.instructions.setValue('Updated synthetic instructions across routes.');
    editor.reviewDraft();
    harness.detectChanges();

    editor.saveDraft();

    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe(`${base}/sample-draft-01`);
    expect(text()).toContain('Updated synthetic instructions across routes.');

    await harness.navigateByUrl(base, PrescriptionList);

    expect(text()).toContain('Sample patient A');

    await harness.navigateByUrl(`${base}/sample-draft-01`, PrescriptionDetail);

    expect(text()).toContain('Updated synthetic instructions across routes.');
  });

  it('shows an unavailable message for an unknown prescription', async () => {
    await harness.navigateByUrl(`${base}/unknown-prescription`, PrescriptionDetail);

    expect(text()).toContain('Prescription unavailable');
    expect(text()).not.toContain('Sample patient A');
  });

  it('opens another doctor draft as read-only', async () => {
    await harness.navigateByUrl(`${base}/sample-other-owner-01/edit`, PrescriptionEditor);

    expect(text()).toContain('This prescription is read-only');
    expect(harness.routeNativeElement!.querySelector('form')).toBeNull();
  });

  it('offers the explicit issue preview only from an owner doctor draft', async () => {
    const store = TestBed.inject(PrescriptionDraftPreviewStore);
    const renewal = store.createLinkedDraft(
      'sample-active-01',
      'renew',
      'Synthetic renewal issue preview test.',
    );

    await harness.navigateByUrl(`${base}/${renewal.id}`, PrescriptionDetail);

    expect(text()).toContain('Renewal draft only.');
    expect(text()).toContain('Review and issue preview');
    expect(harness.routeNativeElement!.querySelector('a[href*="/issue"]')).not.toBeNull();
  });

  it.each(['', '/sample-draft-01', '/sample-draft-01/edit'])(
    'denies the Patient role access to %s',
    async (suffix) => {
      roles.setActiveRole('Patient');

      await harness.navigateByUrl(`${base}${suffix}`, AccessDeniedStub);

      expect(TestBed.inject(Router).url).toBe('/access-denied');
      expect(text()).toContain('Access denied');
      expect(text()).not.toContain('Sample patient A');
    },
  );
  it('clears lifecycle form state when navigating to another prescription', async () => {
    const detail = await harness.navigateByUrl(`${base}/sample-replacement-01`, PrescriptionDetail);

    detail.reason.set('Synthetic completion reason.');
    detail.finishPrescription();
    harness.detectChanges();

    expect(text()).toContain('Sample prescription marked as completed.');

    detail.action.set('cancel');
    detail.reason.set('Reason belonging to the previous prescription.');
    detail.selectLinkedAction('reissue');
    detail.linkedReason.set('Linked reason belonging to the previous prescription.');

    const previous = await harness.navigateByUrl(
      `${base}/sample-superseded-01`,
      PrescriptionDetail,
    );
    harness.detectChanges();

    // Angular reuses the component when only the route ID changes.
    expect(previous).toBe(detail);
    expect(previous.action()).toBe('complete');
    expect(previous.reason()).toBe('');
    expect(previous.actionError()).toBe('');
    expect(previous.actionMessage()).toBe('');
    expect(previous.linkedAction()).toBe('correct');
    expect(previous.linkedReason()).toBe('');
    expect(previous.linkedError()).toBe('');
    expect(text()).not.toContain('Sample prescription marked as completed.');
  });

  it('defaults to Renewal when opening a completed prescription', async () => {
    await harness.navigateByUrl(base, PrescriptionList);

    const store = harness.routeDebugElement!.injector.get(PrescriptionDraftPreviewStore);

    store.finish('sample-active-01', 'complete', 'Synthetic completion before opening the page.');

    const detail = await harness.navigateByUrl(`${base}/sample-active-01`, PrescriptionDetail);
    harness.detectChanges();

    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#linked-action')!;

    expect(detail.linkedAction()).toBe('renew');
    expect(select.value).toBe('renew');
    expect(select.selectedOptions[0].disabled).toBe(false);
    expect(select.querySelector<HTMLOptionElement>('option[value="correct"]')!.disabled).toBe(true);

    detail.linkedReason.set('Synthetic renewal reason.');
    await detail.createLinkedDraft();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toMatch(/\/edit$/);
    expect(detail.linkedError()).toBe('');
  });

  it('switches Correction to Renewal after completing the current prescription', async () => {
    const detail = await harness.navigateByUrl(`${base}/sample-active-01`, PrescriptionDetail);

    expect(detail.linkedAction()).toBe('correct');

    detail.reason.set('Synthetic completion reason.');
    detail.finishPrescription();
    harness.detectChanges();

    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#linked-action')!;

    expect(detail.prescription()?.status).toBe('completed');
    expect(detail.linkedAction()).toBe('renew');
    expect(select.value).toBe('renew');
    expect(select.selectedOptions[0].disabled).toBe(false);
  });
});
