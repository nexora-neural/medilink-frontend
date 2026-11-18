import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ProfessionalVerification } from './professional-verification';
import { ProfessionalVerificationService } from './professional-verification.service';

describe('ProfessionalVerification', () => {
  let component: ProfessionalVerification;
  let fixture: ComponentFixture<ProfessionalVerification>;

  let auth: {
    getOwnProfile: ReturnType<typeof vi.fn>;
  };

  let api: {
    updateProfile: ReturnType<typeof vi.fn>;
    uploadEvidence: ReturnType<typeof vi.fn>;
    submit: ReturnType<typeof vi.fn>;
    listOwn: ReturnType<typeof vi.fn>;
    listOrganizations: ReturnType<typeof vi.fn>;
    getDocument: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      getOwnProfile: vi.fn().mockResolvedValue({
        professional_profile: null,
      }),
    };

    api = {
      updateProfile: vi.fn().mockResolvedValue({}),

      uploadEvidence: vi.fn().mockResolvedValue({
        id: 'doc-1',
        original_filename: 'evidence.pdf',
      }),

      submit: vi.fn().mockResolvedValue({
        id: 'application-1',
        role: 'doctor',
        registration_number: 'D123',
        status: 'pending',
        submitted_at: '2026-11-15T00:00:00Z',
        evidence_document_ids: ['doc-1'],
      }),

      listOwn: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        page_size: 20,
        total: 0,
      }),

      listOrganizations: vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        page_size: 20,
        total: 0,
      }),

      getDocument: vi.fn().mockResolvedValue({
        id: 'doc-1',
        original_filename: 'evidence.pdf',
      }),

      download: vi.fn().mockResolvedValue(new Blob(['file'])),
    };

    await TestBed.configureTestingModule({
      imports: [ProfessionalVerification],
      providers: [
        provideRouter([]),
        { provide: ProfessionalVerificationService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
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

    component.selectedFiles = [
      new File(['content'], 'evidence.pdf', {
        type: 'application/pdf',
      }),
    ];

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

    component.verificationForm.patchValue({
      role: 'doctor',
      registrationNumber: 'D123',
    });

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

  it('shows backend failures and allows retry', async () => {
    api.listOwn.mockRejectedValueOnce(new Error('offline'));

    await component.loadApplication();

    expect(component.loadError).toContain('could not be loaded');
    expect(component.loading).toBe(false);
  });
});
