import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SuperAdminPreview } from './super-admin-preview';
import { PreviewData } from './preview-data';

describe('Super Admin organization preview', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SuperAdminPreview],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { previewPage: 'organization' },
              paramMap: convertToParamMap({ id: 'central-laboratory' }),
            },
          },
        },
      ],
    });
  });

  it('requires a reason before changing sample status and writes a sample audit entry', () => {
    const fixture = TestBed.createComponent(SuperAdminPreview);
    const component = fixture.componentInstance;
    const data = TestBed.inject(PreviewData);
    component.prepare('Approve organization');
    component.confirm();
    expect(component.selectedOrganization()?.status).toBe('Pending');
    expect(data.activity()).toHaveLength(2);
    component.reason.set('Reviewed sample');
    component.confirm();
    expect(component.selectedOrganization()?.status).toBe('Approved');
    expect(data.activity()[0].reason).toBe('Reviewed sample');
    expect(data.organizations().filter((item) => item.status === 'Pending')).toHaveLength(0);
  });
});
