import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  FormRoot,
  max,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Dispatcher } from '@ngrx/signals/events';
import { Account } from '../travel/auth';
import type { LeavesSafely } from '../travel/trip-routes';
import type { Destination } from '../travel/destination';
import { bookingEvents, TravelStore, type Booking as TripBooking } from '../travel/travel.store';

interface BookingModel {
  startDate: string;
  travelers: number;
  name: string;
  email: string;
  requests: string;
  terms: boolean;
}

function isoDay(offsetDays: number): string {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

@Component({
  selector: 'app-booking',
  imports: [FormField, FormRoot, RouterLink, CurrencyPipe, NgOptimizedImage],
  template: `
    @let trip = live();
    <div class="container page">
      <a class="back" [routerLink]="['/destinations', trip.id]">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>{{ trip.name }}</span>
      </a>

      @if (confirmed(); as done) {
        <section class="done" aria-labelledby="done-title">
          <span class="done-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <p class="badge">Booking {{ done.id }}</p>
          <h1 id="done-title">You're going to {{ trip.name }}</h1>
          <p>
            {{ done.travelers }} {{ done.travelers === 1 ? 'traveler' : 'travelers' }} from
            {{ done.startDate }}, {{ done.total | currency: 'EUR' : 'symbol' : '1.0-0' }} in total.
            A confirmation is on its way to <span class="email">{{ done.email }}</span
            >.
          </p>
          <div class="done-actions">
            <a class="btn btn-primary" routerLink="/trips">View My Trips</a>
            <a class="btn" routerLink="/destinations">Keep Exploring</a>
          </div>
        </section>
      } @else {
        <h1>Book your trip</h1>
        <div class="layout">
          <form [formRoot]="booking" class="panel" novalidate aria-labelledby="form-title">
            <h2 id="form-title">Trip details</h2>
            <div class="row">
              <div class="field">
                <label for="start">Departure date</label>
                <input
                  id="start"
                  type="date"
                  [min]="earliest"
                  [formField]="booking.startDate"
                  [attr.aria-invalid]="
                    showErrors(booking.startDate().invalid(), booking.startDate().touched())
                  "
                  aria-describedby="start-errors"
                />
                <div id="start-errors" class="errors">
                  @if (booking.startDate().touched()) {
                    @for (error of booking.startDate().errors(); track error.kind) {
                      <p>{{ error.message }}</p>
                    }
                  }
                </div>
              </div>
              <div class="field">
                <label for="travelers">Travelers</label>
                <input
                  id="travelers"
                  type="number"
                  inputmode="numeric"
                  [formField]="booking.travelers"
                  [attr.aria-invalid]="
                    showErrors(booking.travelers().invalid(), booking.travelers().touched())
                  "
                  aria-describedby="travelers-errors travelers-hint"
                />
                <p id="travelers-hint" class="hint">{{ trip.seats }} seats left</p>
                <div id="travelers-errors" class="errors">
                  @if (booking.travelers().touched()) {
                    @for (error of booking.travelers().errors(); track error.kind) {
                      <p>{{ error.message }}</p>
                    }
                  }
                </div>
              </div>
            </div>

            <h2 class="section">Lead traveler</h2>
            <div class="row">
              <div class="field">
                <label for="name">Full name</label>
                <input
                  id="name"
                  autocomplete="name"
                  [formField]="booking.name"
                  [attr.aria-invalid]="
                    showErrors(booking.name().invalid(), booking.name().touched())
                  "
                  aria-describedby="name-errors"
                />
                <div id="name-errors" class="errors">
                  @if (booking.name().touched()) {
                    @for (error of booking.name().errors(); track error.kind) {
                      <p>{{ error.message }}</p>
                    }
                  }
                </div>
              </div>
              <div class="field">
                <label for="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autocomplete="email"
                  spellcheck="false"
                  [formField]="booking.email"
                  [attr.aria-invalid]="
                    showErrors(booking.email().invalid(), booking.email().touched())
                  "
                  aria-describedby="email-errors"
                />
                <div id="email-errors" class="errors">
                  @if (booking.email().touched()) {
                    @for (error of booking.email().errors(); track error.kind) {
                      <p>{{ error.message }}</p>
                    }
                  }
                </div>
              </div>
            </div>

            <div class="field">
              <label for="requests"
                >Anything we should know? <span class="optional">Optional</span></label
              >
              <textarea
                id="requests"
                rows="3"
                placeholder="Dietary needs, accessibility, celebrations…"
                [formField]="booking.requests"
              ></textarea>
            </div>

            <label
              class="check"
              [class.invalid]="showErrors(booking.terms().invalid(), booking.terms().touched())"
            >
              <input
                type="checkbox"
                [formField]="booking.terms"
                [attr.aria-invalid]="
                  showErrors(booking.terms().invalid(), booking.terms().touched())
                "
                aria-describedby="terms-errors"
              />
              <span>I agree to the booking terms and the free cancellation policy.</span>
            </label>
            <div id="terms-errors" class="errors">
              @if (booking.terms().touched()) {
                @for (error of booking.terms().errors(); track error.kind) {
                  <p>{{ error.message }}</p>
                }
              }
            </div>

            <p class="status" role="status">{{ status() }}</p>
            <button type="submit" class="btn btn-primary wide" [disabled]="booking().submitting()">
              @if (booking().submitting()) {
                <span class="spinner" aria-hidden="true"></span>
              }
              {{ booking().submitting() ? 'Booking…' : 'Confirm Booking' }}
            </button>
          </form>

          <section class="summary" aria-label="Summary">
            <img [ngSrc]="trip.image" width="1400" height="875" [alt]="trip.imageAlt" priority />
            <div class="summary-body">
              <h2>{{ trip.name }}</h2>
              <p class="muted">{{ trip.nights }} nights · {{ trip.country }}</p>
              <dl>
                <div>
                  <dt>Per person</dt>
                  <dd>{{ trip.price | currency: 'EUR' : 'symbol' : '1.0-0' }}</dd>
                </div>
                <div>
                  <dt>Travelers</dt>
                  <dd>{{ travelers() }}</dd>
                </div>
                <div class="total">
                  <dt>Total</dt>
                  <dd>{{ total() | currency: 'EUR' : 'symbol' : '1.0-0' }}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-top: 32px;
      padding-bottom: 72px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      min-height: 32px;
      margin-left: -4px;
      padding: 0 8px 0 4px;
      border-radius: 8px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition:
        background-color 0.15s var(--ease),
        color 0.15s var(--ease);
    }
    .back span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .back svg {
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .back:hover {
      background: var(--subtle);
      color: var(--ink);
    }
    h1 {
      margin: 12px 0 24px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.15;
      letter-spacing: -0.02em;
      overflow-wrap: anywhere;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 32px;
      align-items: start;
    }
    .panel {
      display: grid;
      gap: 4px;
      min-width: 0;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg, 16px);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 18px;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }
    h2.section {
      margin-top: 12px;
      padding-top: 24px;
      border-top: 1px solid var(--line);
    }
    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 0 16px;
    }
    .field {
      display: grid;
      align-content: start;
      gap: 6px;
      min-width: 0;
    }
    label {
      font-size: 14px;
      font-weight: 600;
    }
    .optional,
    .hint {
      color: var(--muted);
      font-size: 13px;
      font-weight: 400;
    }
    .optional {
      margin-left: 4px;
    }
    .hint {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    input:not([type='checkbox']),
    textarea {
      box-sizing: border-box;
      display: block;
      width: 100%;
      min-width: 0;
      height: var(--control-h, 40px);
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      transition:
        border-color 0.15s var(--ease),
        box-shadow 0.15s var(--ease);
    }
    input[type='number'] {
      font-variant-numeric: tabular-nums;
    }
    textarea {
      height: auto;
      padding: 10px 12px;
    }
    textarea::placeholder {
      color: var(--muted);
      opacity: 1;
    }
    input:not([type='checkbox']):hover,
    textarea:hover {
      border-color: var(--muted);
    }
    input:not([type='checkbox']):focus-visible,
    textarea:focus-visible {
      border-color: var(--brand);
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 28%, transparent);
    }
    input[aria-invalid='true']:not([type='checkbox']) {
      border-color: var(--danger-ink);
    }
    input[aria-invalid='true']:not([type='checkbox']):focus-visible {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger-ink) 24%, transparent);
    }
    .errors {
      min-height: 24px;
    }
    .errors p {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 0;
      padding-top: 2px;
      color: var(--danger-ink);
      font-size: 13px;
      line-height: 1.4;
    }
    .errors p::before,
    .status::before {
      content: '';
      flex: none;
      width: 14px;
      height: 14px;
      margin-top: 2px;
      background: currentColor;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='9.5'/%3E%3Cpath d='M12 7.5v5.5M12 16.5v.01'/%3E%3C/svg%3E")
        center / contain no-repeat;
    }
    .check {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font-weight: 400;
      cursor: pointer;
      transition:
        border-color 0.15s var(--ease),
        background-color 0.15s var(--ease);
    }
    .check:hover {
      border-color: var(--line-strong);
    }
    .check.invalid {
      border-color: var(--danger-ink);
      background: var(--danger-soft);
    }
    .check input {
      flex: none;
      width: 18px;
      height: 18px;
      margin: 2px 0 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .status {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 4px 0 12px;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, var(--danger-ink) 35%, transparent);
      border-radius: 10px;
      background: var(--danger-soft);
      color: var(--danger-ink);
      font-size: 14px;
      font-weight: 500;
    }
    .status:empty {
      margin: 0;
      padding: 0;
      border: 0;
    }
    .status:empty::before {
      display: none;
    }
    .wide {
      width: 100%;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .summary {
      position: sticky;
      top: 88px;
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg, 16px);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    .summary img {
      width: 100%;
      height: auto;
      display: block;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      background: var(--subtle);
    }
    .summary-body {
      padding: 20px;
    }
    .summary h2 {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .muted {
      margin: 4px 0 16px;
      color: var(--muted);
      font-size: 14px;
    }
    dl {
      display: grid;
      gap: 8px;
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    dl div {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-weight: 600;
      text-align: right;
    }
    .total {
      margin-top: 4px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      font-size: 18px;
    }
    .total dt {
      color: var(--ink);
      font-weight: 600;
    }
    .total dd {
      font-weight: 700;
    }
    .done {
      display: grid;
      justify-items: center;
      max-width: 620px;
      margin: 40px auto 0;
      padding: 40px 32px 32px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg, 16px);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      text-align: center;
      animation: rise 0.3s ease-out;
    }
    .done-mark {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
      border-radius: 50%;
      background: var(--ok-soft);
      color: var(--ok-ink);
    }
    .done-mark svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .done h1 {
      margin: 12px 0 8px;
      font-size: clamp(24px, 4vw, 32px);
    }
    .badge {
      display: inline-block;
      margin: 0;
      padding: 4px 12px;
      border-radius: 99px;
      background: var(--brand-soft);
      color: var(--brand-strong);
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .done p:not(.badge) {
      max-width: 48ch;
      margin: 0;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .email {
      color: var(--ink);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .done-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 24px;
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (max-width: 860px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
        gap: 24px;
      }
      .summary {
        position: static;
        order: -1;
      }
    }
    @media (max-width: 480px) {
      .panel,
      .summary-body {
        padding: 20px 16px;
      }
      .done {
        margin-top: 24px;
        padding: 32px 16px 24px;
      }
      .done-actions .btn {
        flex: 1 1 100%;
      }
    }
  `,
})
export class Booking implements LeavesSafely {
  readonly destination = input.required<Destination>();
  private readonly store = inject(TravelStore);
  private readonly account = inject(Account);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dispatcher = inject(Dispatcher);

  protected readonly earliest = isoDay(7);
  protected readonly status = signal('');
  protected readonly confirmed = signal<TripBooking | null>(null);
  protected readonly live = computed(
    () =>
      this.store.destinations().find((d) => d.id === this.destination().id) ?? this.destination(),
  );

  private readonly model = signal<BookingModel>({
    startDate: '',
    travelers: 2,
    name: this.account.name() ?? '',
    email: this.account.email() ?? '',
    requests: '',
    terms: false,
  });

  protected readonly booking = form(
    this.model,
    (path) => {
      required(path.startDate, { message: 'Pick a departure date' });
      validate(path.startDate, ({ value }) =>
        value() && value() < this.earliest
          ? { kind: 'too-soon', message: 'Departures open 7 days from today' }
          : null,
      );
      min(path.travelers, 1, { message: 'At least one traveler' });
      validate(path.travelers, ({ value }) =>
        Number.isInteger(value())
          ? null
          : { kind: 'whole-number', message: 'Enter a whole number of travelers' },
      );
      max(path.travelers, () => this.live().seats, {
        message: 'There are not enough seats left',
      });
      required(path.name, { message: 'Enter the lead traveler’s name' });
      minLength(path.name, 2, { message: 'Enter the full name' });
      required(path.email, { message: 'Enter an email for the confirmation' });
      email(path.email, { message: 'Enter a valid email address' });
      validate(path.terms, ({ value }) =>
        value() ? null : { kind: 'terms', message: 'Accept the terms to book' },
      );
    },
    {
      submission: {
        action: async (tree) => {
          const value = tree().value();
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (this.destroyRef.destroyed) return;
          const trip = this.live();
          const created = this.store.book({
            destinationId: trip.id,
            destinationName: trip.name,
            startDate: value.startDate,
            travelers: value.travelers,
            name: value.name,
            email: value.email,
            ...(value.requests.trim() ? { requests: value.requests.trim() } : {}),
            total: value.travelers * trip.price,
          });
          if (!created) {
            this.status.set(
              `Only ${trip.seats} seats are left now. Change the number of travelers.`,
            );
            return;
          }
          this.store.trackSelection(created.id);
          this.account.signIn(value.name, value.email);
          this.confirmed.set(created);
          this.status.set('');
          this.dispatcher.dispatch(bookingEvents.created(created));
        },
        onInvalid: () => this.status.set('Check the highlighted fields.'),
      },
    },
  );

  protected readonly travelers = computed(() => Math.max(0, this.model().travelers || 0));
  protected readonly total = computed(() => this.travelers() * this.live().price);

  protected showErrors(invalid: boolean, touched: boolean) {
    return invalid && touched;
  }

  canLeave(): boolean {
    return !!this.confirmed() || !this.booking().dirty();
  }
}
