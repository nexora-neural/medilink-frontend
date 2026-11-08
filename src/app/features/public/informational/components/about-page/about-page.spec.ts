import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AboutPageComponent } from './about-page';

describe('AboutPageComponent', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'about',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [AboutPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AboutPageComponent);
    fixture.componentRef.setInput('page', data.page);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.about-layout h2')?.textContent).toContain('health information');
  });
});
