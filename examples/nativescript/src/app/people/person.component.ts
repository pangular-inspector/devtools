import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, inject } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptRouterModule } from '@nativescript/angular';
import { PersonService } from './person.service';
import { DevtoolsShowcaseComponent } from '../devtools-showcase.component';

@Component({
  selector: 'ns-person',
  templateUrl: './person.component.html',
  imports: [NativeScriptCommonModule, NativeScriptRouterModule, DevtoolsShowcaseComponent],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonComponent {
  personService = inject(PersonService);
}
