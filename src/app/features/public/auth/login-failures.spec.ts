import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { AccessFormComponent } from './components/access-form/access-form';

describe('login failure handling', () => {
  const signIn = vi.fn();
  beforeEach(async () => {
    signIn.mockReset();
    await TestBed.configureTestingModule({
      imports: [AccessFormComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { signIn } }],
    }).compileComponents();
  });

  it('clears loading and reports backend unavailable', async () => {
    signIn.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    const fixture = TestBed.createComponent(AccessFormComponent);
    fixture.componentInstance.page = 'login';
    fixture.detectChanges();
    await fixture.componentInstance.submit({ valid: true } as never);
    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toContain('service is unavailable');
  });

  it('clears loading and reports Firebase network failure', async () => {
    signIn.mockRejectedValue({ code: 'auth/network-request-failed' });
    const fixture = TestBed.createComponent(AccessFormComponent);
    fixture.componentInstance.page = 'login';
    fixture.detectChanges();
    await fixture.componentInstance.submit({ valid: true } as never);
    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.message).toContain('service is unavailable');
  });
});
