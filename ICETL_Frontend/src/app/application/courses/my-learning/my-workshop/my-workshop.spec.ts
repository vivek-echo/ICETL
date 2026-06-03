import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyWorkshop } from './my-workshop';

describe('MyWorkshop', () => {
  let component: MyWorkshop;
  let fixture: ComponentFixture<MyWorkshop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyWorkshop]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyWorkshop);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
