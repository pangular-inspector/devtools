// An example Pangular plugin: the demo's TravelStore in its own Plugins tab.
// It is written against a small source, not the store, so a test can drive it
// without Angular; `travel-plugin.provider.ts` connects it to the store.
import type { PangularPagePlugin, PluginView } from '@pangular-inspector/devtools/plugin';

export const TRAVEL_PLUGIN_ID = 'travel';
export const TRAVEL_PLUGIN_VERSION = '1.0.0';

export interface TravelBooking {
  id: string;
  destinationName: string;
  startDate: string;
  travelers: number;
  total: number;
  email: string;
}

/** What the plugin reads and changes. */
export interface TravelSource {
  bookings(): readonly TravelBooking[];
  saved(): readonly string[];
  recentQueries(): readonly string[];
  filters(): { query: string; region: string; sort: string };
  /** Removes every saved destination. */
  unsaveAll(): void;
}

/** The view the Plugins tab shows. */
export function travelView(source: TravelSource): PluginView {
  const bookings = source.bookings();
  const saved = source.saved();
  const filters = source.filters();
  const travelers = bookings.reduce((sum, booking) => sum + booking.travelers, 0);
  const total = bookings.reduce((sum, booking) => sum + booking.total, 0);
  return {
    summary: `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}, ${saved.length} saved ${saved.length === 1 ? 'destination' : 'destinations'}`,
    badges:
      filters.region === 'All' ? [] : [{ label: `Region: ${filters.region}`, tone: 'accent' }],
    sections: [
      {
        kind: 'stats',
        title: 'Totals',
        items: [
          { label: 'Bookings', value: bookings.length },
          { label: 'Travelers', value: travelers },
          { label: 'Booked', value: `$${total.toLocaleString('en-US')}` },
          { label: 'Saved', value: saved.length, tone: saved.length ? 'ok' : 'neutral' },
        ],
      },
      {
        kind: 'table',
        title: 'Bookings',
        columns: [
          { key: 'id', label: 'Booking' },
          { key: 'destination', label: 'Destination' },
          { key: 'start', label: 'Starts' },
          { key: 'travelers', label: 'Travelers' },
          { key: 'total', label: 'Total' },
          { key: 'email', label: 'Email' },
        ],
        rows: bookings.map((booking) => ({
          id: booking.id,
          destination: booking.destinationName,
          start: booking.startDate,
          travelers: booking.travelers,
          total: booking.total,
          email: booking.email,
        })),
        empty: 'No bookings yet. Book a trip from a destination page.',
      },
      {
        kind: 'list',
        title: 'Recent searches',
        items: source.recentQueries().map((query) => ({ label: query })),
        empty: 'No searches yet.',
      },
      { kind: 'tree', title: 'Filters', value: filters },
    ],
    actions: saved.length
      ? [
          {
            name: 'unsave-all',
            label: 'Clear saved destinations',
            confirm: 'Remove every saved destination from the store?',
          },
        ]
      : [],
  };
}

/** The page plugin. */
export function travelPlugin(source: TravelSource): PangularPagePlugin {
  return {
    id: TRAVEL_PLUGIN_ID,
    version: TRAVEL_PLUGIN_VERSION,
    title: 'Travel store',
    description: 'Bookings, saved destinations and searches from the demo TravelStore.',
    collect: () => travelView(source),
    actions: {
      'unsave-all': () => {
        const removed = source.saved().length;
        source.unsaveAll();
        return { removed };
      },
    },
  };
}
