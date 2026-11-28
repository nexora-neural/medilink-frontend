import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { PatientNotifications } from './patient-notifications';
import { PatientNotificationPreviewStore } from './patient-notification-preview.store';

describe('PatientNotifications', () => {
  let listFor: ReturnType<typeof vi.fn>;
  let markRead: ReturnType<typeof vi.fn>;
  let markAllRead: ReturnType<typeof vi.fn>;

  async function setup(
    list = vi.fn().mockResolvedValue([
      {
        id: 'medication-reminder',
        category: 'medication',
        icon: 'medication',
        title: 'Medication reminder',
        body: 'Review your medication schedule for today.',
        time: 'Today',
        path: '/workspace/patient/medications',
        read: false,
      },
      {
        id: 'doctor-access',
        category: 'account',
        icon: 'shield_person',
        title: 'Doctor access',
        body: 'Review your shared access and permissions.',
        time: 'Earlier',
        path: '/workspace/patient/access',
        read: true,
      },
    ]),
  ) {
    listFor = list;
    markRead = vi.fn().mockResolvedValue(undefined);
    markAllRead = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PatientNotifications],
      providers: [
        provideRouter([]),
        {
          provide: PatientNotificationPreviewStore,
          useValue: { listFor, markRead, markAllRead },
        },
      ],
    }).compileComponents();
    TestBed.inject(ActiveRoleService).setAccountRoles('patient-test-a', ['patient']);
    const fixture = TestBed.createComponent(PatientNotifications);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads sample notifications and presents unread status and refresh controls', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Sample notifications for this patient account');
    expect(element.textContent).toContain('1 unread');
    expect(element.querySelector('.notification-row.unread')).not.toBeNull();
    expect(
      element.querySelector('button[aria-label="Mark Medication reminder as read"]'),
    ).not.toBeNull();
    expect(listFor).toHaveBeenCalledWith('patient-test-a');
  });

  it('marks one notification and all notifications read', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const unread = component.notifications().find((item) => !item.read)!;

    await component.markRead(unread);
    fixture.detectChanges();
    expect(markRead).toHaveBeenCalledWith('patient-test-a', 'medication-reminder');
    expect(component.unreadCount()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('You’re all caught up');

    await component.refresh();
    await component.markAllRead();
    expect(markAllRead).toHaveBeenCalledWith('patient-test-a');
    expect(component.notifications().every((item) => item.read)).toBe(true);
  });

  it('shows an empty state when no sample notifications are returned', async () => {
    const fixture = await setup();
    listFor.mockResolvedValueOnce([]);
    await fixture.componentInstance.refresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No notifications yet');
    expect(fixture.nativeElement.querySelector('.notification-list')).toBeNull();
  });

  it('shows an initial error and retries successfully', async () => {
    const failingList = vi
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce([
        {
          id: 'medication-reminder',
          category: 'medication',
          icon: 'medication',
          title: 'Medication reminder',
          body: 'Review your medication schedule for today.',
          time: 'Today',
          path: '/workspace/patient/medications',
          read: false,
        },
      ]);
    const fixture = await setup(failingList);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Notifications are unavailable');
    const retry = fixture.nativeElement.querySelector('app-ui-state button') as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listFor).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Medication reminder');
  });

  it('keeps controls keyboard focusable with descriptive accessible names', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;
    const refresh = element.querySelector<HTMLButtonElement>('button[aria-busy]')!;
    const firstLink = element.querySelector<HTMLAnchorElement>('.notification-copy a')!;

    refresh.focus();
    expect(document.activeElement).toBe(refresh);
    firstLink.focus();
    expect(document.activeElement).toBe(firstLink);
    expect(firstLink.getAttribute('aria-label')).toContain('Medication reminder');
  });
});
