import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonalInformationCard } from './personal-information-card';

describe('PersonalInformationCard', () => {
  let component: PersonalInformationCard;
  let fixture: ComponentFixture<PersonalInformationCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInformationCard],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalInformationCard);
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

  it('rejects whitespace-only name and phone', () => {
    component.form.setValue({ name: '  ', email: 'test@example.com', phone: '  ' });
    component.save();
    expect(component.form.invalid).toBe(true);
  });
});
