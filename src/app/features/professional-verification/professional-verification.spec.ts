import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfessionalVerification } from './professional-verification';

describe('ProfessionalVerification', () => {
  let component: ProfessionalVerification;
  let fixture: ComponentFixture<ProfessionalVerification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfessionalVerification],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalVerification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
