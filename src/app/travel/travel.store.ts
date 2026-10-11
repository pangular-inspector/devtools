import { addEntity, removeEntity, withEntities } from '@ngrx/signals/entities';
import { eventGroup, on, withReducer } from '@ngrx/signals/events';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  type,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, pipe, tap } from 'rxjs';
import { DESTINATIONS, type Destination, type Region } from './destination';

export type SortOrder = 'popular' | 'price' | 'rating';

export interface Booking {
  id: string;
  destinationId: string;
  destinationName: string;
  startDate: string;
  travelers: number;
  name: string;
  email: string;
  requests?: string;
  total: number;
}

// Dispatched by the booking/trips pages through the platform-wide Dispatcher
// (see @ngrx/signals/events) once a booking is made or cancelled. The
// withReducer below reacts to them independently of book()/cancel() — that
// decoupling is the whole point of the events plugin.
export const bookingEvents = eventGroup({
  source: 'Booking',
  events: {
    created: type<Booking>(),
    cancelled: type<string>(),
  },
});

interface TravelState {
  destinations: Destination[];
  query: string;
  region: Region | 'All';
  sort: SortOrder;
  saved: string[];
  nextBookingNumber: number;
  bookingSelectedId: string | null;
  bookingActivity: number;
  recentQueries: string[];
  lastViewedBookingAt: number | null;
}

const initialState: TravelState = {
  destinations: DESTINATIONS,
  query: '',
  region: 'All',
  sort: 'popular',
  saved: [],
  nextBookingNumber: 1041,
  bookingSelectedId: null,
  bookingActivity: 0,
  recentQueries: [],
  lastViewedBookingAt: null,
};

const SAVED_KEY = 'travel.saved';

function readSaved(): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const TravelStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  // Bookings live in a withEntities() collection (id -> Booking) instead of a
  // plain array, purely so the devtools Signal Store inspector has a real
  // entities example to show (ids, count, selected). `bookings` below stays a
  // plain Booking[] computed so every consumer keeps working unchanged.
  withEntities({ entity: type<Booking>(), collection: 'booking' }),
  withReducer(
    on(bookingEvents.created, bookingEvents.cancelled, (_, state) => ({
      bookingActivity: state.bookingActivity + 1,
    })),
  ),
  withComputed(({ destinations, query, region, sort, saved, bookingEntities }) => ({
    bookings: computed(() => bookingEntities()),
    results: computed(() => {
      const text = query().trim().toLowerCase();
      const list = destinations().filter(
        (d) =>
          (region() === 'All' || d.region === region()) &&
          (!text || `${d.name} ${d.country} ${d.summary}`.toLowerCase().includes(text)),
      );
      const order: Record<SortOrder, (a: Destination, b: Destination) => number> = {
        popular: (a, b) => b.reviews - a.reviews,
        price: (a, b) => a.price - b.price,
        rating: (a, b) => b.rating - a.rating,
      };
      return [...list].sort(order[sort()]);
    }),
    regions: computed(() => [...new Set(destinations().map((d) => d.region))]),
    savedDestinations: computed(() => destinations().filter((d) => saved().includes(d.id))),
    savedCount: computed(() => saved().length),
    upcomingTrips: computed(() =>
      [...bookingEntities()].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    ),
  })),
  withMethods((store) => ({
    setQuery(query: string): void {
      patchState(store, { query });
    },
    setRegion(region: Region | 'All'): void {
      patchState(store, { region });
    },
    setSort(sort: SortOrder): void {
      patchState(store, { sort });
    },
    isSaved(id: string): boolean {
      return store.saved().includes(id);
    },
    toggleSaved(id: string): void {
      patchState(store, (state) => ({
        saved: state.saved.includes(id)
          ? state.saved.filter((saved) => saved !== id)
          : [...state.saved, id],
      }));
    },
    book(booking: Omit<Booking, 'id'>): Booking | null {
      const destination = store.destinations().find((d) => d.id === booking.destinationId);
      if (!destination || booking.travelers < 1 || booking.travelers > destination.seats) {
        return null;
      }
      const created = { ...booking, id: `TRV-${store.nextBookingNumber()}` };
      patchState(store, addEntity(created, { collection: 'booking' }), (state) => ({
        nextBookingNumber: state.nextBookingNumber + 1,
        bookingSelectedId: created.id,
        destinations: state.destinations.map((d) =>
          d.id === booking.destinationId ? { ...d, seats: d.seats - booking.travelers } : d,
        ),
      }));
      return created;
    },
    cancel(bookingId: string): void {
      const booking = store['bookingEntityMap']()[bookingId];
      if (!booking) return;
      patchState(store, removeEntity(bookingId, { collection: 'booking' }), (state) => ({
        bookingSelectedId: state.bookingSelectedId === bookingId ? null : state.bookingSelectedId,
        destinations: state.destinations.map((d) =>
          d.id === booking.destinationId ? { ...d, seats: d.seats + booking.travelers } : d,
        ),
      }));
    },
    trackSearch: rxMethod<string>(
      pipe(
        debounceTime(250),
        filter((q) => q.trim().length > 0),
        distinctUntilChanged(),
        tap((q) =>
          patchState(store, (state) => ({
            recentQueries: [q, ...state.recentQueries.filter((prev) => prev !== q)].slice(0, 5),
          })),
        ),
      ),
    ),
    trackSelection: signalMethod<string | null>((id) => {
      if (id !== null) patchState(store, { lastViewedBookingAt: Date.now() });
    }),
  })),
  withHooks({
    onInit(store) {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
      patchState(store, { saved: readSaved() });
      effect(
        () => {
          try {
            sessionStorage.setItem(SAVED_KEY, JSON.stringify(store.saved()));
          } catch {
            return;
          }
        },
        { debugName: 'persistSaved' },
      );
    },
  }),
);
