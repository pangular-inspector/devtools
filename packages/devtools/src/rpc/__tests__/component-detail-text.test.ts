import { describe, expect, it } from 'vitest';
import type { ComponentDetail, ComponentProp } from '../../types.ts';
import { DETAIL_VALUE_MAX, inspectComponentText } from '../component-detail-text.ts';
import { MAX_TOOL_CHARS } from '../router-tools.ts';

const detail = (overrides: Partial<ComponentDetail> = {}): ComponentDetail => ({
  id: 'c2',
  name: 'Card',
  tag: 'app-card',
  path: 'app-root > app-card',
  inputs: [{ name: 'title', prop: 'title', value: 'Rome' }],
  outputs: [],
  properties: [],
  listeners: [],
  directives: [],
  dependencies: [],
  ...overrides,
});

const HEADING = 'Live detail of `Card`.';
const body = (text: string) => JSON.parse(text.slice(text.indexOf('\n{') + 1)) as ComponentDetail;
const prop = (name: string, value: unknown): ComponentProp => ({ name, prop: name, value });

describe('inspectComponentText', () => {
  it('returns the heading and the whole detail when it fits', () => {
    const text = inspectComponentText(detail(), HEADING);
    expect(text.startsWith(`${HEADING}\n\n{`)).toBe(true);
    expect(body(text)).toEqual(detail());
    expect(text).not.toMatch(/not shown|only the start/);
  });

  it('cuts long values to their start and names them', () => {
    const big = 'x'.repeat(30_000);
    const text = inspectComponentText(
      detail({
        inputs: [prop('title', 'Rome'), prop('rows', big)],
        properties: [prop('cache', { blob: big })],
        directives: [{ name: 'Tooltip', inputs: [prop('text', big)], outputs: [] }],
      }),
      HEADING,
    );
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).toContain(
      '3 values are longer than 1,000 characters and show only the start of their JSON: `rows`, `cache`, `Tooltip.text`.',
    );
    expect(text).toContain(
      'The `detail` of the pangular:component-tree resource has every value in full.',
    );
    const json = body(text);
    expect(json.inputs[0].value).toBe('Rome');
    expect(json.inputs[1].value).toBe(`${JSON.stringify(big).slice(0, DETAIL_VALUE_MAX)}…`);
    expect(json.directives[0].inputs[0].value).toMatch(/…$/);
  });

  it('keeps fewer entries per list and says how many are not shown', () => {
    const properties = Array.from({ length: 60 }, (_, n) => prop(`p${n}`, 'v'.repeat(900)));
    const dependencies = Array.from({ length: 60 }, (_, n) => ({
      from: 'Card',
      token: `Service${n}`,
      flags: [],
      providedBy: 'r1',
    }));
    const text = inspectComponentText(detail({ properties, dependencies }), HEADING);
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).toContain(
      'Each list shows its first 10 entries: 50 more properties, 50 more dependencies not shown.',
    );
    const json = body(text);
    expect(json.properties).toHaveLength(10);
    expect(json.dependencies).toHaveLength(10);
    expect(json.inputs).toHaveLength(1);
  });

  it('shortens the inputs and outputs of a directive and counts what it left out', () => {
    const inputs = Array.from({ length: 400 }, (_, n) => prop(`i${n}`, 'v'.repeat(200)));
    const outputs = Array.from({ length: 300 }, (_, n) => ({
      name: `o${n}`,
      prop: `o${n}`,
      listened: false,
    }));
    const text = inspectComponentText(
      detail({ directives: [{ name: 'Tooltip', inputs, outputs }] }),
      HEADING,
    );
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).not.toContain('(truncated;');
    expect(text).toContain(
      'Each list shows its first 40 entries: 360 more Tooltip inputs, 260 more Tooltip outputs not shown.',
    );
    const [directive] = body(text).directives;
    expect(directive.inputs).toHaveLength(40);
    expect(directive.outputs).toHaveLength(40);
  });

  it('falls back to the shared cut with a pointer to the full detail', () => {
    const text = inspectComponentText(detail({ path: 'a > '.repeat(10_000) }), HEADING);
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).toMatch(
      /… \(truncated; read the `detail` of the pangular:component-tree resource for every value in full\)$/,
    );
  });

  it('keeps redacted values as the page sent them', () => {
    const text = inspectComponentText(
      detail({
        inputs: [prop('token', '[redacted]'), prop('rows', 'x'.repeat(30_000))],
      }),
      HEADING,
    );
    expect(body(text).inputs[0].value).toBe('[redacted]');
  });
});
