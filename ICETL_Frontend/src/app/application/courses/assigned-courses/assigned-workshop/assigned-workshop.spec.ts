import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignedWorkshop } from './assigned-workshop';

describe('AssignedWorkshop', () => {
  let component: AssignedWorkshop;
  let fixture: ComponentFixture<AssignedWorkshop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignedWorkshop]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignedWorkshop);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
