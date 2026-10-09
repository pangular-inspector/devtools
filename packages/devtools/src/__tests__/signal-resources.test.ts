import { describe, expect, it } from 'vitest';
import { serializeNamed } from '../serialize.ts';
import { groupResources } from '../signal-resources.ts';
import type { SignalGraphEdge, SignalGraphNode } from '../types.ts';

const serialize = (_label: string, value: unknown) => value;

function node(
  id: string,
  kind: string,
  label?: string,
  value?: unknown,
  epoch = 1,
): SignalGraphNode {
  return {
    id,
    kind: kind as SignalGraphNode['kind'],
    epoch,
    ...(label ? { label } : {}),
    ...(value !== undefined ? { value } : {}),
  };
}

describe('groupResources', () => {
  it('tells two unnamed resources apart by their edges and numbers them', () => {
    const nodes = [
      node('1', 'signal', 'stream', 'user signal'),
      node('2', 'computed', 'Resource.value', 'a'),
      node('3', 'linkedSignal', 'Resource.state'),
      node('4', 'linkedSignal', 'Resource.extRequest'),
      node('5', 'computed', 'Resource.value', 'b'),
      node('6', 'linkedSignal', 'Resource.state'),
      node('7', 'computed', undefined, true),
    ];
    const edges: SignalGraphEdge[] = [
      { consumer: 1, producer: 2 },
      { consumer: 2, producer: 3 },
      { consumer: 3, producer: 0 },
      { consumer: 4, producer: 5 },
      { consumer: 6, producer: 4 },
    ];
    const resources = groupResources(nodes, edges, [], serialize);
    expect(resources.map((r) => [r.name, r.named, r.value, r.nodeIds])).toEqual([
      ['resource 1', false, 'a', ['2', '3', '4']],
      ['resource 2', false, 'b', ['5', '6', '7']],
    ]);
  });

  it('derives status from the graph when no instance holds the resource', () => {
    const nodes = [
      node('1', 'computed', 'Resource#trips.value', '(threw an error)'),
      node('2', 'computed', 'Resource#trips.error', 'Error: 500'),
      node('3', 'computed', 'Resource#trips.isLoading', false),
      node('4', 'linkedSignal', 'Resource#trips.state', undefined, 4),
    ];
    const edges = [
      { consumer: 0, producer: 3 },
      { consumer: 1, producer: 3 },
      { consumer: 2, producer: 3 },
    ];
    const [trips] = groupResources(nodes, edges, [], serialize);
    expect(trips).toMatchObject({
      id: 'resource:1',
      name: 'trips',
      status: 'error',
      error: 'Error: 500',
      isLoading: false,
      epoch: 4,
    });
    expect('value' in trips).toBe(false);
  });

  it('leaves user signals alone', () => {
    const nodes = [node('1', 'signal', 'count', 1), node('2', 'computed', undefined, 2)];
    expect(groupResources(nodes, [{ consumer: 1, producer: 0 }], [], serialize)).toEqual([]);
  });

  it('masks secret query values in the url of an httpResource request', () => {
    const signalOf = (raw: object) => {
      const fn = () => undefined;
      (fn as unknown as Record<symbol, unknown>)[Symbol('SIGNAL')] = raw;
      return fn;
    };
    const instance = {
      user: {
        debugName: 'user',
        state: signalOf({
          version: 2,
          value: {
            status: 'resolved',
            extRequest: {
              request: { method: 'GET', urlWithParams: '/api/me?api_key=sk_live_abc123&page=2' },
              reload: 0,
            },
          },
        }),
        extRequest: signalOf({ version: 1 }),
        value: signalOf({ version: 3, value: 'ada' }),
      },
    };
    const nodes = [
      node('1', 'computed', 'Resource#user.value', 'ada', 3),
      node('2', 'linkedSignal', 'Resource#user.state', undefined, 2),
      node('3', 'linkedSignal', 'Resource#user.extRequest', undefined, 1),
    ];
    const edges = [
      { consumer: 0, producer: 1 },
      { consumer: 1, producer: 2 },
    ];
    const [user] = groupResources(nodes, edges, [instance], (label, value) =>
      serializeNamed(label, value),
    );
    expect(JSON.stringify(user.params)).not.toContain('sk_live_abc123');
    expect(user.params).toEqual({ method: 'GET', url: '/api/me?api_key=[redacted]&page=2' });
  });
});
