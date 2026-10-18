import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Keep the generated MCP token out of the home folder while tests run. The
// folder belongs to this test file and goes when the file's tests finish, so
// runs do not pile up `pangular-test-*` folders in the temp directory.
if (!process.env['PANGULAR_MCP_TOKEN_FILE']) {
  const dir = mkdtempSync(join(tmpdir(), 'pangular-test-'));
  process.env['PANGULAR_MCP_TOKEN_FILE'] = join(dir, 'mcp-token');
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env['PANGULAR_MCP_TOKEN_FILE'];
  });
}
