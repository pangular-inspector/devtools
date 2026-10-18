// pnpm hooks. Only packing is changed: nothing here affects how dependencies resolve.

/**
 * Drops the fields that only matter inside this workspace from the package.json that ships in a
 * tarball (`pnpm pack`, `pnpm publish`): dev dependencies, the Nx target settings and the build
 * scripts. The published manifest then holds only what an installer and a bundler read.
 */
function beforePacking(pkg) {
  if (pkg.name !== '@pangular-inspector/devtools') return pkg;
  const { devDependencies: _dev, nx: _nx, scripts: _scripts, ...published } = pkg;
  return published;
}

module.exports = { hooks: { beforePacking } };
