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
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
