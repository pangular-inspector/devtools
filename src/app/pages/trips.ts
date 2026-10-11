import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dispatcher } from '@ngrx/signals/events';
import { Account } from '../travel/auth';
import { bookingEvents, TravelStore } from '../travel/travel.store';

@Component({
  selector: 'app-trips',
  imports: [RouterLink, CurrencyPipe, NgOptimizedImage],
  template: `
    <div class="container page">
      <p class="eyebrow signed">Signed in as {{ account.name() }}</p>
      <h1>My trips</h1>
      <p class="status" role="status">{{ message() }}</p>

      @if (trips().length) {
        <ul class="trips">
          @for (trip of trips(); track trip.booking.id) {
            <li class="trip">
              @if (trip.destination; as place) {
                <img [ngSrc]="place.image" width="1400" height="875" alt="" />
              } @else {
                <span class="thumb" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28">
                    <path
                      d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
                    />
                  </svg>
                </span>
              }
              <div class="info">
                <p class="ref">{{ trip.booking.id }}</p>
                <h2>
                  <a [routerLink]="['/destinations', trip.booking.destinationId]">{{
                    trip.booking.destinationName
                  }}</a>
                </h2>
                <p class="muted">
                  Departs
                  <time [attr.datetime]="trip.booking.startDate">{{ trip.booking.startDate }}</time>
                  · {{ trip.booking.travelers }}
                  {{ trip.booking.travelers === 1 ? 'traveler' : 'travelers' }}
                </p>
              </div>
              <div class="side">
                <p class="total">{{ trip.booking.total | currency: 'EUR' : 'symbol' : '1.0-0' }}</p>
                <button type="button" class="btn cancel" (click)="cancel(trip.booking.id)">
                  Cancel Trip
                </button>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="empty">
          <span class="empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M3 7h18v13H3zM8 7V4h8v3M3 12h18" />
            </svg>
          </span>
          <h2>No trips booked yet</h2>
          <p>When you book a trip it shows up here, with everything you need for the day.</p>
          <a class="btn btn-primary" routerLink="/destinations">Browse Destinations</a>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-top: 40px;
      padding-bottom: 72px;
    }
    .signed {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    h1 {
      margin: 0 0 16px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .status {
      margin: 0 0 16px;
      padding: 10px 14px;
      border: 1px solid color-mix(in srgb, var(--ok-ink) 30%, transparent);
      border-radius: var(--radius, 12px);
      background: var(--ok-soft);
      color: var(--ok-ink);
      font-size: 14px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      animation: fade 0.2s var(--ease, ease-out);
    }
    .status:empty {
      margin: 0;
      padding: 0;
      border: 0;
    }
    .trips {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .trip {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr) auto;
      gap: 20px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg, 16px);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.15s var(--ease, ease);
    }
    .trip:hover {
      border-color: var(--line-strong);
    }
    .trip img,
    .thumb {
      display: block;
      width: 160px;
      height: 100px;
      object-fit: cover;
      border-radius: var(--radius-sm, 8px);
      background: var(--subtle);
    }
    .thumb {
      display: grid;
      place-items: center;
      color: var(--muted);
    }
    .thumb svg,
    .empty-mark svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .info {
      min-width: 0;
    }
    .ref {
      margin: 0;
      color: var(--brand);
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    h2 {
      margin: 4px 0;
      font-size: 19px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    h2 a {
      color: var(--ink);
      text-decoration: none;
      text-underline-offset: 3px;
    }
    h2 a:hover {
      color: var(--brand);
      text-decoration: underline;
    }
    .muted {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }
    .side {
      display: grid;
      justify-items: end;
      gap: 8px;
      padding-right: 8px;
    }
    .total {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .cancel {
      min-height: 36px;
      padding: 0 14px;
      font-size: 14px;
    }
    .cancel:hover {
      border-color: var(--danger-ink);
      background: var(--danger-soft);
      color: var(--danger-ink);
    }
    .empty {
      display: grid;
      justify-items: center;
      padding: 56px 24px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-lg, 16px);
      background: var(--surface);
      text-align: center;
    }
    .empty-mark {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand);
    }
    .empty h2 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    .empty p {
      max-width: 44ch;
      margin: 0 0 24px;
      color: var(--muted);
    }
    @keyframes fade {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    @media (max-width: 700px) {
      .trip {
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }
      .trip img,
      .thumb {
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
      }
      .info {
        padding: 0 4px;
      }
      .side {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 12px;
        padding: 12px 4px 4px;
        border-top: 1px solid var(--line);
      }
    }
    @media (max-width: 480px) {
      .empty {
        padding: 40px 16px;
      }
    }
  `,
})
export class Trips {
  protected readonly account = inject(Account);
  private readonly store = inject(TravelStore);
  private readonly dispatcher = inject(Dispatcher);
  protected readonly message = signal('');
  protected readonly trips = computed(() => {
    const email = this.account.email();
    return this.store
      .upcomingTrips()
      .filter((booking) => booking.email === email)
      .map((booking) => ({
        booking,
        destination: this.store.destinations().find((d) => d.id === booking.destinationId),
      }));
  });

  protected cancel(id: string) {
    if (!this.trips().some((trip) => trip.booking.id === id)) return;
    this.store.cancel(id);
    this.store.trackSelection(this.store.bookingSelectedId());
    this.dispatcher.dispatch(bookingEvents.cancelled(id));
    this.message.set(`Trip ${id} was cancelled and the seats were released.`);
  }
}
