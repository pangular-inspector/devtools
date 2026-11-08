import { Component, computed, input } from '@angular/core';
import {
  byteText,
  payloadInsights,
  type PayloadEntryLike,
} from '@pangular-inspector/devtools/internal/http-data';

/**
 * Size checks for the TransferState payload of the selected page: a budget
 * warning, the largest entries with size bars, and URLs the transfer cache
 * stored under more than one key. It only reads what the page reported.
 */
@Component({
  selector: 'app-payload-insights',
  templateUrl: './payload-insights.html',
  styleUrl: './payload-insights.scss',
})
export class PayloadInsights {
  readonly size = input(0);
  readonly entries = input<readonly PayloadEntryLike[]>([]);

  readonly insights = computed(() =>
    payloadInsights({ size: this.size(), entries: this.entries() }),
  );

  bytes(value: number): string {
    return byteText(value);
  }
}
