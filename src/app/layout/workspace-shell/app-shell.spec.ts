import { provideRouter, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActiveRoleService } from '../../core/context/active-role.service';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  let fixture: ComponentFixture<AppShell>;
  let roles: ActiveRoleService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShell);
    roles = TestBed.inject(ActiveRoleService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows role-based navigation and passes the active role to the header', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.workspace-label')?.textContent).toContain('Patient workspace');
    expect(element.querySelector('.role-chip')?.textContent).toContain('Patient');
    expect(element.querySelector('a[href="/workspace/professional-verification"]')).not.toBeNull();
  });

  it.each(['Doctor', 'Pharmacist', 'Lab Staff'] as const)(
    'links %s to the professional verification application',
    async (role) => {
      roles.setActiveRole(role);
      fixture.detectChanges();
      await fixture.whenStable();
      const link = fixture.nativeElement.querySelector(
        'a[href="/workspace/professional-verification"]',
      ) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('Verification');
      expect(
        fixture.nativeElement.querySelector('a[href="/workspace/doctor/verification"]'),
      ).toBeNull();
    },
  );

  it('keeps the mobile menu and role selection coordinated across child components', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (element.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen).toBe(true);
    expect(element.querySelector('.menu-button')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.sidebar')?.classList).toContain('open');

    const select = element.querySelector('#active-role') as HTMLSelectElement;
    select.value = 'Doctor';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(roles.activeRole()).toBe('Doctor');
    expect(fixture.componentInstance.menuOpen).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/workspace']);
    expect(element.querySelector('.user-summary')?.textContent).toContain('Doctor account');
  });
  it('closes the mobile navigation when the scrim is selected', () => {
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (element.querySelector('.sidebar-scrim') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen).toBe(false);
    expect(element.querySelector('.sidebar-scrim')).toBeNull();
    expect(element.querySelector('.menu-button')?.getAttribute('aria-expanded')).toBe('false');
  });
});
