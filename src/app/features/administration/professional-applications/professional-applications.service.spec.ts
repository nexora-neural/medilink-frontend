import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { canReview, ProfessionalApplicationsService } from './professional-applications.service';

describe('ProfessionalApplicationsService', () => {
  const applicationId = 'a87d99f1-652c-4c0e-85b7-50a863f1f2b1';
  const userId = '1838c503-08f3-49a1-a512-212d24eb67b0';
  const documentId = '604c84a0-152e-46ec-b77e-6ca8202924ab';
  const application = {
    id: applicationId,
    user_id: userId,
    organization_id: 'b2f189a7-b5d7-4f6b-a0cf-ab88fb9c788e',
    role: 'doctor',
    registration_number: 'SLMC-2045',
    status: 'pending',
    submitted_at: '2026-11-21T08:00:00Z',
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null,
    evidence_document_ids: [documentId],
    applicant_display_name: 'Nadeesha Perera',
    organization_name: 'Central Clinic',
  };

  let auth: {
    getAuthorized: ReturnType<typeof vi.fn>;
    getAuthorizedBlob: ReturnType<typeof vi.fn>;
    postAuthorized: ReturnType<typeof vi.fn>;
  };
  let service: ProfessionalApplicationsService;

  beforeEach(() => {
    auth = {
      getAuthorized: vi.fn(),
      getAuthorizedBlob: vi.fn(),
      postAuthorized: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: auth }],
    });
    service = TestBed.inject(ProfessionalApplicationsService);
  });

  it('loads the real queue and maps applicant and organization details', async () => {
    auth.getAuthorized.mockResolvedValue({
      items: [application],
      page: 1,
      page_size: 100,
      total: 1,
    });

    const items = await firstValueFrom(service.list());

    expect(auth.getAuthorized).toHaveBeenCalledWith(
      'admin/verification-applications?page=1&page_size=100',
    );
    expect(items[0]).toMatchObject({
      id: applicationId,
      userId,
      name: 'Nadeesha Perera',
      role: 'Doctor',
      organization: 'Central Clinic',
      registration: 'SLMC-2045',
      status: 'Pending',
    });
  });

  it('does not allow a decision on an application that has not been submitted', async () => {
    auth.getAuthorized.mockResolvedValue({
      items: [{ ...application, status: 'not_submitted' }],
      page: 1,
      page_size: 100,
      total: 1,
    });
    const items = await firstValueFrom(service.list());
    expect(items[0].status).toBe('Not submitted');
    expect(canReview(items[0].status)).toBe(false);
  });

  it('reports incomplete pagination instead of silently showing a partial queue', async () => {
    auth.getAuthorized.mockResolvedValue({ items: [], page: 1, page_size: 100, total: 1 });
    await expect(firstValueFrom(service.list())).rejects.toThrow('pagination is incomplete');
  });

  it('records a decision through the API and reloads persisted reviewer history', async () => {
    const approved = {
      ...application,
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: '2026-11-21T09:00:00Z',
      review_reason: 'SLMC details manually compared.',
    };
    auth.postAuthorized.mockResolvedValue(approved);
    auth.getAuthorized.mockImplementation((path: string) => {
      if (path === `admin/verification-applications/${applicationId}`) {
        return Promise.resolve(approved);
      }
      if (path.includes('/decisions?')) {
        return Promise.resolve({
          items: [
            {
              id: '7aa55a27-2446-4bdb-929e-6ccaf0c164f2',
              application_id: applicationId,
              reviewer_user_id: userId,
              reviewer_display_name: 'Admin Reviewer',
              decision: 'approved',
              reason: 'SLMC details manually compared.',
              decided_at: '2026-11-21T09:00:00Z',
            },
          ],
          page: 1,
          page_size: 100,
          total: 1,
        });
      }
      if (path === `documents/${documentId}`) {
        return Promise.resolve({
          id: documentId,
          document_type: 'verification_evidence',
          original_filename: 'slmc-card.pdf',
          created_at: '2026-11-20T08:00:00Z',
        });
      }
      if (path.startsWith('admin/organizations/')) {
        return Promise.resolve({ id: application.organization_id, name: 'Central Clinic' });
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    const updated = await firstValueFrom(
      service.recordDecision(applicationId, 'Approved', '  SLMC details manually compared.  '),
    );

    expect(auth.postAuthorized).toHaveBeenCalledWith(
      `admin/verification-applications/${applicationId}/decision`,
      { status: 'approved', reason: 'SLMC details manually compared.' },
    );
    expect(updated.status).toBe('Approved');
    expect(updated.history).toEqual([
      {
        decision: 'Approved',
        reviewer: 'Admin Reviewer',
        decidedAt: '2026-11-21T09:00:00Z',
        reason: 'SLMC details manually compared.',
      },
    ]);
    expect(updated.evidence[0]).toMatchObject({
      id: documentId,
      fileName: 'slmc-card.pdf',
    });
  });

  it('downloads evidence only through the authenticated private content route', async () => {
    const blob = new Blob(['private evidence']);
    auth.getAuthorized.mockResolvedValue({ original_filename: 'proof.pdf' });
    auth.getAuthorizedBlob.mockResolvedValue(blob);

    const result = await service.downloadEvidence(documentId);

    expect(auth.getAuthorized).toHaveBeenCalledWith(`documents/${documentId}`);
    expect(auth.getAuthorizedBlob).toHaveBeenCalledWith(`documents/${documentId}/content`);
    expect(result).toEqual({ blob, fileName: 'proof.pdf' });
  });
});
