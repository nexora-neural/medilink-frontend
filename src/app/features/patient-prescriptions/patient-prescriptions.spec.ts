import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { roleGuard } from '../../core/guards/role.guard';
import { PatientPrescriptions } from './patient-prescriptions';
import {
  PATIENT_PRESCRIPTIONS_STORE,
  PATIENT_PRESCRIPTION_OCR_PROCESSOR,
  PatientPrescriptionsPreviewStore,
  PrescriptionOcrResult,
} from './patient-prescriptions.store';

describe('Patient-added prescriptions', () => {
  let store: PatientPrescriptionsPreviewStore;
  let ocrProcessor: { extract: (file: File) => Promise<PrescriptionOcrResult> };
  const sampleOcrDraft: PrescriptionOcrResult = {
    status: 'completed',
    draft: {
      prescribedOn: '2026-01-01',
      prescriber: 'Example OCR prescriber',
      clinic: 'Example OCR clinic',
      notes: 'Check against the original.',
      medicines: [
        {
          name: 'Sample medicine',
          strength: 'As printed',
          instructions: 'Review against original',
        },
      ],
    },
  };
  beforeEach(async () => {
    store = new PatientPrescriptionsPreviewStore();
    ocrProcessor = { extract: vi.fn().mockResolvedValue(sampleOcrDraft) };
    await TestBed.configureTestingModule({
      imports: [PatientPrescriptions],
      providers: [
        provideRouter([]),
        { provide: PATIENT_PRESCRIPTIONS_STORE, useValue: store },
        { provide: PATIENT_PRESCRIPTION_OCR_PROCESSOR, useValue: ocrProcessor },
      ],
    })
      .overrideComponent(PatientPrescriptions, {
        set: {
          providers: [
            { provide: PATIENT_PRESCRIPTIONS_STORE, useValue: store },
            { provide: PATIENT_PRESCRIPTION_OCR_PROCESSOR, useValue: ocrProcessor },
          ],
        },
      })
      .compileComponents();
  });
  function create() {
    return TestBed.createComponent(PatientPrescriptions);
  }
  function fill(page: PatientPrescriptions) {
    page.add();
    page.startManualEntry();
    page.form.patchValue({
      prescribedOn: '2026-01-01',
      prescriber: 'Dr Example',
      clinic: 'Example clinic',
      confirmation: true,
    });
    page.medicines[0].patchValue({
      name: 'Example medicine',
      strength: '10 mg',
      instructions: 'As written on the prescription',
    });
  }
  it('has a patient-only route and replaces the placeholder', async () => {
    const route = routes
      .find((r) => r.path === 'workspace')
      ?.children?.find((r) => r.path === 'patient/prescriptions');
    expect(await route?.loadComponent?.()).toBe(PatientPrescriptions);
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['allowedRoles']).toEqual(['Patient']);
  });
  it('shows loading then an empty preview with no invented clinical records', async () => {
    const fixture = create();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading prescriptions');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No patient-added prescriptions');
    expect(fixture.nativeElement.textContent).toContain('Preview only');
  });
  it('offers typed/printed English upload and a manual-entry path', () => {
    const fixture = create();
    const page = fixture.componentInstance;
    page.add();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Handwriting is not supported');
    page.chooseOcrUpload();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#prescription-ocr-file')).not.toBeNull();
    page.useManualEntry();
    fixture.detectChanges();
    expect(page.view()).toBe('form');
    expect(fixture.nativeElement.textContent).toContain('Enter prescription details');
  });
  it('validates OCR files and keeps the original selection when a replacement is invalid', () => {
    const page = create().componentInstance;
    page.add();
    page.chooseOcrUpload();
    const accepted = new File(['prescription'], 'original.pdf', { type: 'application/pdf' });
    const input = { files: [accepted], value: 'original.pdf' } as unknown as HTMLInputElement;
    page.onOcrFileSelected({ target: input } as unknown as Event);
    expect(page.files()).toEqual([accepted]);
    expect(input.value).toBe('');

    const rejected = new File(['not a prescription'], 'replacement.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    page.onOcrFileSelected({
      target: { files: [rejected], value: 'replacement.docx' },
    } as unknown as Event);
    expect(page.files()).toEqual([accepted]);
    expect(page.ocrError()).toContain('PDF, JPEG or PNG');
  });
  it('shows processing, compares the original with editable OCR fields, and retains the evidence', async () => {
    const fixture = create();
    const page = fixture.componentInstance;
    page.add();
    page.chooseOcrUpload();
    const original = new File(['printed prescription'], 'printed-prescription.pdf', {
      type: 'application/pdf',
    });
    page.onOcrFileSelected({
      target: { files: [original], value: 'printed-prescription.pdf' },
    } as unknown as Event);
    const processing = page.startOcr();
    expect(page.view()).toBe('ocr-processing');
    await processing;
    fixture.detectChanges();
    expect(page.view()).toBe('ocr-review');
    expect(page.form.controls.prescriber.value).toBe('Example OCR prescriber');
    expect(page.files()).toEqual([original]);
    expect(fixture.nativeElement.textContent).toContain('Original prescription');
    expect(fixture.nativeElement.textContent).toContain('Editable extracted draft');
    expect(fixture.nativeElement.textContent).toContain(original.name);
    expect(fixture.nativeElement.querySelector('#prescriber')).not.toBeNull();
  });
  it('shows extraction failure, retries, and keeps manual fallback attached to the original', async () => {
    const page = create().componentInstance;
    page.add();
    page.chooseOcrUpload();
    const original = new File(['printed prescription'], 'original.jpg', { type: 'image/jpeg' });
    page.onOcrFileSelected({
      target: { files: [original], value: 'original.jpg' },
    } as unknown as Event);
    ocrProcessor.extract = vi
      .fn()
      .mockResolvedValueOnce({ status: 'unreadable' })
      .mockResolvedValueOnce(sampleOcrDraft);

    await page.startOcr();
    expect(page.view()).toBe('ocr-error');
    expect(page.ocrError()).toContain('could not read');
    expect(page.files()).toEqual([original]);
    await page.retryOcr();
    expect(page.view()).toBe('ocr-review');
    expect(ocrProcessor.extract).toHaveBeenCalledTimes(2);
    expect(page.files()).toEqual([original]);
  });
  it('blocks incomplete, whitespace-only and future-dated submissions', () => {
    const fixture = create();
    const page = fixture.componentInstance;
    page.add();
    page.startManualEntry();
    page.review();
    expect(page.view()).toBe('form');
    fill(page);
    page.form.controls.prescriber.setValue('   ');
    page.review();
    expect(page.view()).toBe('form');
    page.form.controls.prescriber.setValue('Doctor');
    page.form.controls.prescribedOn.setValue('2999-01-01');
    page.review();
    expect(page.view()).toBe('form');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });
  it('requires confirmation and supports adding/removing medicine rows', () => {
    const page = create().componentInstance;
    fill(page);
    page.form.controls.confirmation.setValue(false);
    page.review();
    expect(page.view()).toBe('form');
    page.addMedicine();
    expect(page.medicines.length).toBe(2);
    page.removeMedicine(1);
    page.removeMedicine(0);
    expect(page.medicines.length).toBe(1);
    page.form.controls.confirmation.setValue(true);
    page.review();
    expect(page.view()).toBe('review');
  });
  it('keeps labels after confirmation, retains evidence and exposes no clinical action', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    fill(page);
    page.files.set([new File(['evidence'], 'prescription.pdf', { type: 'application/pdf' })]);
    page.review();
    await page.save();
    fixture.detectChanges();
    expect(page.view()).toBe('detail');
    expect(page.selected()?.source).toBe('Patient-added');
    expect(page.selected()?.verification).toBe('Not clinically verified');
    expect(fixture.nativeElement.textContent).toContain('prescription.pdf');
    const actions = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (b) => (b as HTMLButtonElement).textContent,
    );
    expect(actions.some((text) => /dispense|issue|verify/i.test(text ?? ''))).toBe(false);
    page.cancel();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('View details');
  });
  it('shows list errors and supports retry', async () => {
    const spy = vi.spyOn(store, 'list').mockRejectedValueOnce(new Error('offline'));
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Prescriptions are unavailable');
    (fixture.nativeElement.querySelector('app-ui-state button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('No patient-added prescriptions');
  });
  it('preserves the draft on save failure and allows a retry without duplicate clicks', async () => {
    const fixture = create();
    const page = fixture.componentInstance;
    fill(page);
    page.review();
    const spy = vi.spyOn(store, 'add').mockRejectedValueOnce(new Error('offline'));
    await page.save();
    expect(page.view()).toBe('review');
    expect(page.error()).toContain('Your entries are still available');
    expect(page.form.controls.prescriber.value).toBe('Dr Example');
    const first = page.save();
    await page.save();
    await first;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(page.records().length).toBe(1);
  });
  it('supports back/edit and cancel without adding a record', async () => {
    const page = create().componentInstance;
    fill(page);
    page.review();
    page.edit();
    expect(page.form.controls.clinic.value).toBe('Example clinic');
    page.cancel();
    expect(await store.list()).toEqual([]);
  });
  it('accepts native form input and submits through review into details', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.page-heading button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (root.querySelectorAll('.choice')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    for (const [id, value] of Object.entries({
      'prescribed-on': '2026-01-01',
      prescriber: 'Native doctor',
      clinic: 'Native clinic',
      'medicine-0': 'First medicine',
      'instructions-0': 'Written directions',
    })) {
      const input = root.querySelector('#' + id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    (root.querySelector('#confirmation') as HTMLInputElement).click();
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.view()).toBe('review');
    expect(root.textContent).toContain('Native doctor');
    const confirm = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm and add'),
    )!;
    confirm.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.view()).toBe('detail');
    expect(root.textContent).toContain('First medicine');
  });
});
