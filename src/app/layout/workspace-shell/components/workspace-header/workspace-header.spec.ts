import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkspaceHeader } from './workspace-header';

describe('WorkspaceHeader', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'home',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [WorkspaceHeader],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkspaceHeader);
    fixture.componentRef.setInput('activeRole', 'Doctor');
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.user-summary')?.textContent).toContain('Doctor account');
    let toggled = false;
    fixture.componentInstance.menuToggle.subscribe(() => (toggled = true));
    (element.querySelector('.menu-button') as HTMLButtonElement).click();
    expect(toggled).toBe(true);
  });
});
