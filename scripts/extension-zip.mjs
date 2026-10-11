import { execFileSync } from 'node:child_process';
import { createPublicKey } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'dist/pangular-inspector-extension.zip');
const keyPath = process.env.PANGULAR_EXTENSION_KEY;

const stage = mkdtempSync(join(tmpdir(), 'pangular-extension-'));
try {
  cpSync(join(root, 'extension'), stage, {
    recursive: true,
    filter: (src) => !src.endsWith('.DS_Store'),
  });
  const manifestPath = join(stage, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifestKey = manifest.key;
  delete manifest.key;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (keyPath) {
    if (!existsSync(keyPath)) throw new Error(`PANGULAR_EXTENSION_KEY not found: ${keyPath}`);
    const publicKey = createPublicKey(readFileSync(keyPath))
      .export({ type: 'spki', format: 'der' })
      .toString('base64');
    if (publicKey !== manifestKey) {
      throw new Error(
        `PANGULAR_EXTENSION_KEY does not match the key in extension/manifest.json, so the store would give the extension another ID.`,
      );
    }
    cpSync(keyPath, join(stage, 'key.pem'));
  }
  rmSync(out, { force: true });
  execFileSync('zip', ['-qr', out, '.'], { cwd: stage, stdio: 'inherit' });
  console.log(
    `Wrote ${out}${keyPath ? ' with key.pem for the first Web Store upload' : ' without a key (fine for updates)'}`,
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
