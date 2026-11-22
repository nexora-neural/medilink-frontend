import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfessionalVerification } from './professional-verification';
import { ProfessionalVerificationService } from './professional-verification.service';

describe('ProfessionalVerification', () => {
  let component: ProfessionalVerification;
  let fixture: ComponentFixture<ProfessionalVerification>;
  let api: {
    updateProfile: ReturnType<typeof vi.fn>;
    uploadEvidence: ReturnType<typeof vi.fn>;
    submit: ReturnType<typeof vi.fn>;
    listOwn: ReturnType<typeof vi.fn>;
    getDocument: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = {
      updateProfile: vi.fn().mockResolvedValue({}),
      uploadEvidence: vi.fn().mockResolvedValue({ id: 'doc-1', original_filename: 'evidence.pdf' }),
      submit: vi.fn().mockResolvedValue({
        id: 'application-1',
        role: 'doctor',
        registration_number: 'D123',
        status: 'pending',
        submitted_at: '2026-11-15T00:00:00Z',
        evidence_document_ids: ['doc-1'],
      }),
      listOwn: vi.fn().mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 }),
      getDocument: vi.fn().mockResolvedValue({ id: 'doc-1', original_filename: 'evidence.pdf' }),
      download: vi.fn().mockResolvedValue(new Blob(['file'])),
    };
    await TestBed.configureTestingModule({
      imports: [ProfessionalVerification],
      providers: [provideRouter([]), { provide: ProfessionalVerificationService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfessionalVerification);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads an empty application state from the API', () => {
    expect(api.listOwn).toHaveBeenCalledOnce();
    component.viewApplicationStatus();
    expect(component.showStatus).toBe(true);
  });

  it('requires professional details and an evidence document', async () => {
    await component.submitApplication();
    expect(component.application).toBeNull();
    expect(component.fileError).toContain('supporting document');
    expect(component.verificationForm.controls.role.invalid).toBe(true);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('saves the profile, uploads evidence and submits its ID', async () => {
    component.verificationForm.patchValue({
      role: 'doctor',
      registrationNumber: 'D123',
      specialty: 'Medicine',
      qualification: 'MBBS',
    });
    component.selectedFiles = [new File(['content'], 'evidence.pdf', { type: 'application/pdf' })];
    await component.submitApplication();
    expect(api.updateProfile).toHaveBeenCalledWith({
      role: 'doctor',
      registration_number: 'D123',
      qualifications: 'MBBS',
      specialty: 'Medicine',
    });
    expect(api.uploadEvidence).toHaveBeenCalledOnce();
    expect(api.submit).toHaveBeenCalledWith({
      role: 'doctor',
      registration_number: 'D123',
      evidence_document_ids: ['doc-1'],
    });
    expect(component.application?.status).toBe('pending');
  });

  it('reuses successfully uploaded evidence when application submission is retried', async () => {
    api.submit.mockRejectedValueOnce(new Error('temporary failure'));
    component.verificationForm.patchValue({ role: 'doctor', registrationNumber: 'D123' });
    component.selectedFiles = [new File(['content'], 'evidence.pdf')];
    await component.submitApplication();
    await component.submitApplication();
    expect(api.uploadEvidence).toHaveBeenCalledOnce();
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(component.applicationSubmitted).toBe(true);
  });

  it('restores persisted application and document metadata on load', async () => {
    api.listOwn.mockResolvedValueOnce({
      items: [
        {
          id: 'application-1',
          role: 'pharmacist',
          registration_number: 'P123',
          status: 'pending',
          submitted_at: '2026-11-15T00:00:00Z',
          evidence_document_ids: ['doc-1'],
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });
    await component.loadApplication();
    expect(component.applicationSubmitted).toBe(true);
    expect(api.getDocument).toHaveBeenCalledWith('doc-1');
    expect(component.documents[0].original_filename).toBe('evidence.pdf');
  });

  it('shows suspended applications as suspended instead of pending', async () => {
    api.listOwn.mockResolvedValueOnce({
      items: [
        {
          id: 'application-1',
          role: 'doctor',
          registration_number: 'D123',
          status: 'suspended',
          submitted_at: '2026-11-15T00:00:00Z',
          evidence_document_ids: [],
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });
    await component.loadApplication();
    expect(component.statusLabel).toBe('Suspended');
    expect(component.statusHeadingText).toBe('Application suspended');
    expect(component.statusLabel).not.toContain('Pending');
  });

  it.each([
    ['rejected', 'Your application is pending review'],
    ['more_info_requested', 'More information requested'],
  ] as const)('shows reviewer feedback for %s applications', async (status, _heading) => {
    api.listOwn.mockResolvedValueOnce({
      items: [
        {
          id: 'application-1',
          role: 'doctor',
          registration_number: 'D123',
          status,
          submitted_at: '2026-11-15T00:00:00Z',
          evidence_document_ids: [],
          review_reason: 'Please provide the missing registration evidence.',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });

    await component.loadApplication();
    component.viewApplicationStatus();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reviewer feedback:');
    expect(fixture.nativeElement.textContent).toContain(
      'Please provide the missing registration evidence.',
    );
  });

  it('does not render reviewer feedback when none was supplied', async () => {
    api.listOwn.mockResolvedValueOnce({
      items: [
        {
          id: 'application-1',
          role: 'doctor',
          registration_number: 'D123',
          status: 'rejected',
          submitted_at: '2026-11-15T00:00:00Z',
          evidence_document_ids: [],
          review_reason: null,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });

    await component.loadApplication();
    component.viewApplicationStatus();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Reviewer feedback:');
  });

  it('shows backend failures and allows retry', async () => {
    api.listOwn.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' }),
    );
    await component.loadApplication();
    expect(component.loadError).toBe('The service is unavailable. Please try again later.');
    expect(component.loading).toBe(false);

    fixture.detectChanges();
    const retry = fixture.nativeElement.querySelector('button.primary-button') as HTMLButtonElement;
    expect(retry.textContent).toContain('Try again');
    retry.click();
    await fixture.whenStable();

    expect(api.listOwn).toHaveBeenCalledTimes(3);
    expect(component.loadError).toBe('');
    expect(component.loading).toBe(false);
  });

  it('shows a clear message when evidence access is denied', async () => {
    api.listOwn.mockResolvedValueOnce({
      items: [
        {
          id: 'application-1',
          role: 'doctor',
          registration_number: 'D123',
          status: 'pending',
          submitted_at: '2026-11-15T00:00:00Z',
          evidence_document_ids: ['doc-1'],
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    });
    api.download.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }),
    );

    await component.loadApplication();
    await component.downloadDocument('doc-1');

    expect(component.downloadError).toBe(
      'You are not permitted to access this verification resource.',
    );
    expect(component.downloadMessage).toBe('');
  });
});
