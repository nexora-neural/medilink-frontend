import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfessionalApplicationsService } from './professional-applications.service';
import { ProfessionalApplicationDetail } from './professional-application-detail';

describe('ProfessionalApplicationDetail', () => {
  const application = {
    id: 'application-1',
    userId: 'user-1',
    name: 'Sample applicant',
    role: 'Doctor' as const,
    organization: 'Sample clinic',
    registration: 'SLMC-2045',
    status: 'Pending' as const,
    evidence: [
      {
        id: 'document-1',
        name: 'Verification evidence',
        fileName: 'proof.pdf',
        uploadedAt: '2026-11-21T08:00:00Z',
      },
    ],
    history: [],
  };
  let fixture: ComponentFixture<ProfessionalApplicationDetail>;
  let service: {
    get: ReturnType<typeof vi.fn>;
    recordDecision: ReturnType<typeof vi.fn>;
    downloadEvidence: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      get: vi.fn().mockReturnValue(of(application)),
      recordDecision: vi.fn(),
      downloadEvidence: vi.fn().mockResolvedValue({
        blob: new Blob(['private evidence']),
        fileName: 'proof.pdf',
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ProfessionalApplicationDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: application.id })) },
        },
        { provide: ProfessionalApplicationsService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalApplicationDetail);
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the saved result when the decision succeeds but details cannot be reloaded', async () => {
    const approved = {
      ...application,
      status: 'Approved' as const,
      history: [
        {
          decision: 'Approved' as const,
          reviewer: 'Admin reviewer',
          decidedAt: '2026-11-21T09:00:00Z',
          reason: 'SLMC details manually compared.',
        },
      ],
    };
    service.recordDecision.mockReturnValue(of({ application: approved, detailsReloaded: false }));
    const root = fixture.nativeElement as HTMLElement;
    const decision = root.querySelector<HTMLSelectElement>('#decision')!;
    decision.value = 'Approved';
    decision.dispatchEvent(new Event('change', { bubbles: true }));
    const reason = root.querySelector<HTMLTextAreaElement>('#reason')!;
    reason.value = 'SLMC details manually compared.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Decision recorded. See decision history below.');
    expect(root.textContent).toContain(
      'The decision was recorded, but the latest application details could not be loaded.',
    );
    expect(root.textContent).toContain('Reload application details');
    expect(root.textContent).not.toContain('Unable to confirm that the decision was recorded.');
    expect(service.recordDecision).toHaveBeenCalledTimes(1);
  });

  it('defers evidence object URL cleanup after starting the download', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:proof');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const scheduled: Array<() => void> = [];
    vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler, delay?: number) => {
      if (delay === 1000 && typeof handler === 'function') scheduled.push(handler as () => void);
      return 1;
    }) as typeof window.setTimeout);

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button:not([type="submit"])')!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:proof');
  });
});
