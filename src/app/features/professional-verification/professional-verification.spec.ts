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

  it('rejects unsupported files', () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'invalid.exe')] });
    component.onFileSelected({ target: input } as unknown as Event);
    expect(component.selectedFiles).toHaveLength(0);
    expect(component.fileError).toContain('PDF');
  });

  it('accepts multiple supported files and removes only the selected file', () => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [new File(['a'], 'identity.pdf'), new File(['b'], 'registration.png')],
    });
    component.onFileSelected({ target: input } as unknown as Event);
    expect(component.selectedFiles).toHaveLength(2);
    component.removeSelectedFile(0);
    expect(component.selectedFiles.map((file) => file.name)).toEqual(['registration.png']);
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
});
