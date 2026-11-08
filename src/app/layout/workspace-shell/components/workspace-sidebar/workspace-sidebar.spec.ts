import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkspaceSidebar } from './workspace-sidebar';

describe('WorkspaceSidebar', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'home',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [WorkspaceSidebar],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkspaceSidebar);
    fixture.componentRef.setInput('activeRole', 'Doctor');
    fixture.componentRef.setInput('roles', ['Patient', 'Doctor']);
    fixture.componentRef.setInput('navigation', [
      { label: 'Overview', icon: 'dashboard', path: '/workspace' },
    ]);
    fixture.componentRef.setInput('menuOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.workspace-label')?.textContent).toContain('Doctor');
    expect(element.querySelectorAll('.primary-navigation a').length).toBe(1);
    let closed = false;
    fixture.componentInstance.closeMenu.subscribe(() => (closed = true));
    (element.querySelector('.sidebar-scrim') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
