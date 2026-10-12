import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Keep the generated MCP token out of the home folder while tests run.
process.env['PANGULAR_MCP_TOKEN_FILE'] ??= join(
  mkdtempSync(join(tmpdir(), 'pangular-test-')),
  'mcp-token',
);
