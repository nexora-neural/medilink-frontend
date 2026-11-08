import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileSummaryCard } from './profile-summary-card';

describe('ProfileSummaryCard', () => {
  let component: ProfileSummaryCard;
  let fixture: ComponentFixture<ProfileSummaryCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSummaryCard],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSummaryCard);
    fixture.componentRef.setInput('profile', {
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '123456789',
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
