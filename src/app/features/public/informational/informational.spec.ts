import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicInformational } from './informational';

describe('PublicInformational', () => {
  it('renders its content and controls', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const data = {
      page: 'privacy',
      title: 'Example title',
      description: 'Example description',
      code: '403',
    };
    await TestBed.configureTestingModule({
      imports: [PublicInformational],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { data: of(data), queryParams: of({}), snapshot: { data } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicInformational);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-privacy-page h2')?.textContent).toContain(
      'Privacy information',
    );
    expect(element.querySelector('app-terms-page')).toBeNull();
  });
});
