import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WorkspacePage } from './workspace-page';

describe('WorkspacePage', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'home',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [WorkspacePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkspacePage);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Example title');
    expect(element.querySelector('input#display-name')).not.toBeNull();
  });
});
