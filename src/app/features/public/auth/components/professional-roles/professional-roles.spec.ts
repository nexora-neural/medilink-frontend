import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfessionalRolesComponent } from './professional-roles';

describe('ProfessionalRolesComponent', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'roles',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [ProfessionalRolesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProfessionalRolesComponent);
    fixture.componentRef.setInput('page', data.page);
    fixture.componentRef.setInput('roles', [
      { name: 'Patient', icon: '', description: '' },
      { name: 'Doctor', icon: '', description: '' },
      { name: 'Pharmacist', icon: '', description: '' },
      { name: 'Lab Staff', icon: '', description: '' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.role-list a').length).toBe(3);
    expect(element.textContent).toContain('Pharmacist');
  });
});
