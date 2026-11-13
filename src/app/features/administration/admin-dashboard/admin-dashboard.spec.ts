import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  let fixture: ComponentFixture<AdminDashboard>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  function clickButton(label: string): void {
    const button = Array.from(element.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === label,
    );

    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }

  it('shows fictional review counts and identifies operational status as disconnected', () => {
    expect(element.querySelector('h1')?.textContent).toContain('Admin dashboard');
    expect(element.textContent).toContain('Sample preview only');
    expect(element.querySelector('.count')?.textContent?.trim()).toBe('6');

    const rows = Array.from(element.querySelectorAll('.review-list li'));

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Doctor');
    expect(rows[0].querySelector('strong')?.textContent?.trim()).toBe('3');
    expect(rows[1].textContent).toContain('Pharmacist');
    expect(rows[1].querySelector('strong')?.textContent?.trim()).toBe('2');
    expect(rows[2].textContent).toContain('Lab Staff');
    expect(rows[2].querySelector('strong')?.textContent?.trim()).toBe('1');

    expect(element.querySelector('.status-label')?.textContent).toContain('Not connected');
  });

  it('shows an accessible loading state without sample counts', () => {
    clickButton('Loading');

    expect(element.querySelector('.review-card')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Loading application summary',
    );
    expect(element.querySelector('.review-list')).toBeNull();
    expect(element.querySelector('.count')).toBeNull();
  });

  it('shows an empty state without sample counts', () => {
    clickButton('Empty');

    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'No pending applications',
    );
    expect(element.querySelector('.review-list')).toBeNull();
    expect(element.querySelector('.count')).toBeNull();
  });

  it('returns to sample data when retry is selected after an error', () => {
    clickButton('Error');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Application summary unavailable',
    );
    expect(element.querySelector('.count')).toBeNull();

    clickButton('Try again');

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('.count')?.textContent?.trim()).toBe('6');

    const sampleButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Sample data',
    );

    expect(sampleButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('links to delegated account support without exposing clinical or super-admin links', () => {
    const links = Array.from(element.querySelectorAll('a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/workspace/admin/account-support',
    ]);
    expect(links[0].textContent).toContain('Open account support');
  });
});
