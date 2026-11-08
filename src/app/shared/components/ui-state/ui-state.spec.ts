import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiState } from './ui-state';

describe('UiState', () => {
  let fixture: ComponentFixture<UiState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiState] }).compileComponents();
    fixture = TestBed.createComponent(UiState);
    fixture.componentRef.setInput('title', 'No records found');
    fixture.componentRef.setInput('description', 'Your records will appear here.');
  });

  it('renders an empty state with status semantics and no action button', () => {
    fixture.detectChanges();

    const state = fixture.nativeElement.querySelector('section') as HTMLElement;
    expect(state.getAttribute('role')).toBe('status');
    expect(state.querySelector('.state-icon')?.textContent?.trim()).toBe('inbox');
    expect(state.querySelector('h3')?.textContent).toContain('No records found');
    expect(state.querySelector('button')).toBeNull();
  });

  it('renders errors as alerts and emits the retry action when clicked', () => {
    fixture.componentRef.setInput('kind', 'error');
    fixture.componentRef.setInput('actionLabel', 'Try again');
    fixture.detectChanges();

    const state = fixture.nativeElement.querySelector('section') as HTMLElement;
    expect(state.getAttribute('role')).toBe('alert');
    expect(state.querySelector('.state-icon')?.textContent?.trim()).toBe('error_outline');

    let emitted = false;
    fixture.componentInstance.action.subscribe(() => (emitted = true));
    (state.querySelector('button') as HTMLButtonElement).click();
    expect(emitted).toBe(true);
  });
});
