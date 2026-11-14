import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfessionalVerification } from './professional-verification';

describe('ProfessionalVerification', () => {
  let component: ProfessionalVerification;
  let fixture: ComponentFixture<ProfessionalVerification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfessionalVerification],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalVerification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires details and evidence before submission', async () => {
    await component.submitApplication();
    expect(component.applicationSubmitted).toBe(false);
    expect(component.fileError).toContain('supporting document');
    expect(component.verificationForm.controls.role.invalid).toBe(true);
  });

  it('preserves submitted details when the form is edited later', async () => {
    component.verificationForm.setValue({
      fullName: 'Example Doctor',
      email: 'test@example.com',
      role: 'Doctor',
      registrationNumber: 'D123',
      specialty: 'Medicine',
      institution: 'Clinic',
      qualification: 'MBBS',
      notes: '',
    });
    component.selectedFiles = [new File(['sample'], 'evidence.pdf', { type: 'application/pdf' })];
    await component.submitApplication();
    component.viewApplicationForm();
    component.verificationForm.controls.registrationNumber.setValue('CHANGED');
    expect(component.submittedSnapshot?.registrationNumber).toBe('D123');
    expect(component.submittedSnapshot?.documents).toEqual(['evidence.pdf']);
  });

  it('shows an error when an unsupported document is selected', () => {
    const documentsButton = Array.from(fixture.nativeElement.querySelectorAll('nav button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Documents',
    ) as HTMLButtonElement | undefined;

    expect(documentsButton).toBeDefined();
    documentsButton!.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#evidence-document') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['x'], 'invalid.exe')],
    });

    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.selectedFiles).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Choose PDF, JPEG or PNG files.',
    );
  });

  it('updates the application documents when files are selected and removed', () => {
    const documentsButton = Array.from(fixture.nativeElement.querySelectorAll('nav button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Documents',
    ) as HTMLButtonElement | undefined;

    expect(documentsButton).toBeDefined();
    documentsButton!.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#evidence-document') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [
        new File(['a'], 'identity.pdf', { type: 'application/pdf' }),
        new File(['b'], 'registration.png', { type: 'image/png' }),
      ],
    });

    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.selectedFiles.map((file) => file.name)).toEqual([
      'identity.pdf',
      'registration.png',
    ]);

    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Remove identity.pdf"]',
    ) as HTMLButtonElement;

    expect(removeButton).toBeTruthy();
    removeButton.click();
    fixture.detectChanges();

    expect(component.selectedFiles.map((file) => file.name)).toEqual(['registration.png']);
    expect(fixture.nativeElement.querySelectorAll('.file-row')).toHaveLength(1);
  });

  it('reports failed preview submissions and permits retry', async () => {
    component.verificationForm.setValue({
      fullName: 'Example Doctor',
      email: 'test@example.com',
      role: 'Doctor',
      registrationNumber: 'D123',
      specialty: 'Medicine',
      institution: 'Clinic',
      qualification: 'MBBS',
      notes: '',
    });
    component.selectedFiles = [new File(['sample'], 'evidence.pdf')];
    const service = vi
      .spyOn(component as unknown as { submitPreview: () => Promise<void> }, 'submitPreview')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    await component.submitApplication();
    expect(component.submissionError).toContain('try again');
    await component.submitApplication();
    expect(service).toHaveBeenCalledTimes(2);
    expect(component.applicationSubmitted).toBe(true);
  });

  it('navigates between application and documents without losing entered details', () => {
    component.verificationForm.controls.fullName.setValue('Example Doctor');
    fixture.detectChanges();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Continue to documents'))?.click();
    fixture.detectChanges();
    expect(component.showDocuments).toBe(true);
    expect(fixture.nativeElement.querySelector('#evidence-document')).toBeTruthy();
    buttons.find((button) => button.textContent?.trim() === 'Application')?.click();
    fixture.detectChanges();
    expect(component.showDocuments).toBe(false);
    expect(component.verificationForm.controls.fullName.value).toBe('Example Doctor');
  });

  it('shows validation errors when the document step is submitted without required details', async () => {
    component.viewDocuments();
    await component.submitApplication();
    fixture.detectChanges();
    expect(component.showDocuments).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Please enter your full name.');
    expect(component.fileError).toContain('supporting document');
  });

  it('keeps status changes clearly labelled as samples', async () => {
    component.verificationForm.patchValue({
      fullName: 'Example Doctor',
      email: 'test@example.com',
      role: 'Doctor',
      registrationNumber: 'D123',
    });
    component.selectedFiles = [new File(['sample'], 'evidence.pdf')];
    await component.submitApplication();
    component.setPreviewStatus('verified');
    fixture.changeDetectorRef.detectChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Verified (sample)');
    expect(fixture.nativeElement.textContent).toContain(
      'does not change a real application or grant access',
    );
  });
});
