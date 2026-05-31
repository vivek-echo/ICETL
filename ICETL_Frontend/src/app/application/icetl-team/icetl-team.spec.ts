import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcetlTeam } from './icetl-team';

describe('IcetlTeam', () => {
  let component: IcetlTeam;
  let fixture: ComponentFixture<IcetlTeam>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcetlTeam],
    }).compileComponents();

    fixture = TestBed.createComponent(IcetlTeam);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
