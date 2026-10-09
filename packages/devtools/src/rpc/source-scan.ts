import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

// Helpers shared by the RPC functions that read information out of source
// files with regular expressions. None of them parse TypeScript; they only do
// enough lexing to keep strings and comments from being mistaken for code.

/**
 * Index of the `/` that closes the regular expression starting at `start`, or
 * `start` itself when this is a division rather than a literal.
 */
export function skipRegex(source: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') i++;
    else if (ch === '\n') return start;
    else if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i;
  }
  return start;
}

/** Whether the `/` at `at` opens a regular expression rather than dividing. */
export function startsRegex(source: string, at: number): boolean {
  for (let i = at - 1; i >= 0; i--) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
    // After a value, `/` divides; after an operator or a keyword, it opens one.
    // The longest keyword is six characters, and one more is needed to see
    // what precedes it: a bounded window keeps this O(1) per `/` rather than
    // resting on the engine slicing lazily. A `.` rules the keyword out, since
    // `object.of / 2` accesses a property and then divides.
    return (
      !/[\w$)\]]/.test(ch) ||
      /(?:^|[^\w$.])(?:return|typeof|case|in|of|do|else)$/.test(
        source.slice(Math.max(0, i - 6), i + 1),
      )
    );
  }
  return true;
}

/**
 * Index of the quote that closes the string starting at `start`, or `start`
 * itself when there is none.
 *
 * Only a template literal may span lines, so a `'` or `"` left open at the end
 * of its line is not a string at all. It is usually a quote inside a regular
 * expression, as in `/['"]/`, and treating it as a string would blank out the
 * rest of the file.
 */
export function skipString(source: string, start: number): number {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') i++;
    else if (ch === quote) return i;
    else if (ch === '\n' && quote !== '`') return start;
  }
  return start;
}

/**
 * Replace comments with whitespace, keeping every newline so line numbers and
 * offsets still match the original file.
 */
export function stripComments(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    // Comments first: `//` would otherwise look like an empty regex literal.
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop - 1;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) {
        // Unterminated, so not a comment; blanking here would erase the file.
        out += ch;
        continue;
      }
      out += blank(source.slice(i, end + 2));
      i = end + 1;
    } else if (ch === '/' && startsRegex(source, i)) {
      const end = skipRegex(source, i);
      out += source.slice(i, end + 1);
      i = end;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(source, i);
      if (end === i) {
        out += ch;
        continue;
      }
      out += source.slice(i, end + 1);
      i = end;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Replace the contents of regular expression literals with spaces, keeping the
 * delimiters and the length. A pattern is not code, so a call spelled out
 * inside one, as in `/signalStore\(\)/`, must not be reported as a real
 * declaration. Run it after `maskStrings`, so a `/` inside a string is gone.
 */
export function maskRegexes(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch !== '/' || !startsRegex(source, i)) {
      out += ch;
      continue;
    }
    const end = skipRegex(source, i);
    if (end === i) {
      out += ch;
      continue;
    }
    out += ch + blank(source.slice(i + 1, end)) + source[end];
    i = end;
  }
  return out;
}

/**
 * Replace the contents of string and template literals with spaces, keeping
 * the quotes, the length and every newline. Use it before matching patterns
 * that would otherwise fire on code quoted inside a template.
 */
export function maskStrings(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '/' && startsRegex(source, i)) {
      const end = skipRegex(source, i);
      out += source.slice(i, end + 1);
      i = end;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(source, i);
      if (end === i) {
        // Not a string after all, so the quote is just a character.
        out += ch;
        continue;
      }
      out += ch + blank(source.slice(i + 1, end)) + (end < source.length ? source[end] : '');
      i = end;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * A reusable line lookup for one file. Scanning for newlines on every match is
 * quadratic over a file; this walks it once and then binary searches.
 */
export function lineCounter(source: string): (index: number) => number {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1);
  }
  return (index) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

/** Same length as `text`, with every character but the newlines blanked out. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

/** A class body, with the selector of the decorator that precedes it. */
/**
 * A single line type annotation between a member name and its `=`. A top level
 * comma ends it, so `constructor(label: string, count = signal(0))` declares
 * `count` rather than swallowing the parameter list into `label`'s annotation.
 * Commas inside a generic argument list are still part of the annotation.
 */
export const ANNOTATION = String.raw`(?::(?:[^=;\n,<]|=>|<[^;\n]*?>){0,120})?`;

export interface ClassScope {
  start: number;
  end: number;
  component?: string;
  /** The `name` a `@Pipe` decorator gives it, when it carries one. */
  pipeName?: string;
  /** The class's own name, whatever decorator it carries. */
  className?: string;
  /** Which decorator it carries, when it carries one. */
  kind?: 'component' | 'directive' | 'pipe';
  /** That decorator's argument list, parentheses included. */
  decoratorArgs?: string;
}

const DECORATOR = /@(Component|Directive|Pipe)\s*\(/g;

/**
 * The span of every class in the file, each with the selector of the
 * `@Component`/`@Directive`, or the name of the `@Pipe`, decorating it.
 */
export function classScopes(code: string, source: string): ClassScope[] {
  const scopes: ClassScope[] = [];
  const declaration = /\bclass\s+(\w+)/g;
  let previousEnd = 0;
  let match: RegExpExecArray | null;
  // `code` has string contents masked out, so a class written inside a
  // template cannot open a scope; `source` still holds the selector to read.
  while ((match = declaration.exec(code)) !== null) {
    const bodyStart = classBodyStart(code, match.index + match[0].length);
    if (bodyStart === -1) break;
    const end = matchDelimiter(code, bodyStart, '{', '}');
    scopes.push({
      start: match.index,
      end,
      className: match[1],
      ...decoratorOf(code.slice(previousEnd, match.index), source.slice(previousEnd, match.index)),
    });
    previousEnd = end;
    declaration.lastIndex = end;
  }
  return scopes;
}

/**
 * The first `{` that opens the class body, skipping the braces a generic
 * parameter list can hold, as in `class Panel<T extends { id: string }> {`.
 */
function classBodyStart(code: string, from: number): number {
  let angle = 0;
  for (let i = from; i < code.length; i++) {
    const ch = code[i];
    if (ch === '/' && startsRegex(code, i)) i = skipRegex(code, i);
    else if (ch === '"' || ch === "'" || ch === '`') i = skipString(code, i);
    else if (ch === '<') angle++;
    else if (ch === '>' && angle > 0) angle--;
    else if (ch === '{' && angle === 0) return i;
  }
  return -1;
}

/**
 * The selector of the last `@Component`/`@Directive` decorator in `code`, read
 * out of `source` at the same offsets. Both the decorator and the `selector`
 * key are found in the masked copy, so neither a decorator nor a `selector:`
 * written inside a template can be picked up, and only the value is read from
 * the unmasked copy, where it survives.
 */
/**
 * The `@Component`, `@Directive` or `@Pipe` that precedes a class, read once.
 * Matching the decorator name with a word boundary keeps `@ComponentMeta()`
 * from being taken for `@Component`, and returning its arguments here means no
 * caller has to look the decorator up a second time and disagree about which
 * one it is.
 */
function decoratorOf(
  code: string,
  source: string,
): Pick<ClassScope, 'component' | 'pipeName' | 'kind' | 'decoratorArgs'> {
  let open = -1;
  let kind: 'component' | 'directive' | 'pipe' | undefined;
  for (const match of code.matchAll(DECORATOR)) {
    open = match.index + match[0].length - 1;
    kind = match[1] === 'Directive' ? 'directive' : match[1] === 'Pipe' ? 'pipe' : 'component';
  }
  if (open === -1) return {};

  const close = matchDelimiter(code, open, '(', ')');
  const args = code.slice(open, close);
  const decoratorArgs = code.slice(open, close + 1);
  // A pipe is named by `name`, a component or directive by `selector`.
  const key = (kind === 'pipe' ? /\bname\s*:\s*['"`]/ : /\bselector\s*:\s*['"`]/).exec(args);
  if (!key) return { kind, decoratorArgs };
  const quote = open + key.index + key[0].length - 1;
  const value = source.slice(quote + 1, skipString(source, quote));
  return kind === 'pipe'
    ? { pipeName: value, kind, decoratorArgs }
    : { component: value, kind, decoratorArgs };
}

/** Index of the delimiter that closes the one at `open`. */
export function matchDelimiter(source: string, open: number, start: string, end: string): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') i = skipString(source, i);
    else if (ch === '/' && i > open && startsRegex(source, i)) i = skipRegex(source, i);
    else if (ch === start) depth++;
    else if (ch === end && --depth === 0) return i;
  }
  return source.length;
}

/**
 * The directories to scan for source files: every `sourceRoot` in
 * `angular.json`, so a workspace with more than one project is covered, and
 * `src` for a project without one. Falls back to the working directory.
 */
export function sourceRoots(cwd: string): string[] {
  const roots: string[] = [];
  try {
    // The CLI accepts comments and trailing commas in `angular.json`, and a
    // throw here would silently drop every declared project.
    const workspace = JSON.parse(parseJsonc(readFileSync(join(cwd, 'angular.json'), 'utf-8')));
    const projects = workspace?.projects;
    for (const project of Object.values(projects ?? {})) {
      if (!project || typeof project !== 'object') continue;
      const entry = project as Record<string, unknown>;
      const root = entry['sourceRoot'] ?? join(String(entry['root'] ?? ''), 'src');
      if (typeof root === 'string' && root) roots.push(resolve(cwd, root));
    }
  } catch {
    // no workspace file, or it is not readable
  }
  const declared = new Set(roots);
  roots.push(join(cwd, 'src'));

  // Resolve symlinks before comparing: `resolve()` is only string work, so a
  // `sourceRoot` that is a link, or a `src` that is, would otherwise pass the
  // containment check and have its files reported as if they were in here.
  const root = realPath(cwd);
  const seen = new Set<string>();
  // Keyed by real path, so nesting is judged on where a root actually points.
  const realOf = new Map<string, string>();
  const usable = [...new Set(roots)].filter((dir) => {
    const real = realPath(dir);
    if (seen.has(real)) return false;
    const inside = relative(root, real);
    // Must be a strict descendant: `.` resolves to the workspace itself, which
    // would widen every scan to the whole repository.
    if (!inside || escapes(inside) || isAbsolute(inside)) return false;
    // A declared `sourceRoot` is deliberate, so a project really rooted at
    // `src/build` is honoured; only dependencies are refused outright.
    const refused = declared.has(dir) ? DEPENDENCY_DIRS : IGNORED_DIRS;
    if (inside.split(/[\\/]/).some((part) => refused.has(part.toLowerCase()))) return false;
    try {
      if (!statSync(real).isDirectory()) return false;
    } catch {
      return false;
    }
    seen.add(real);
    realOf.set(dir, real);
    return true;
  });

  // A root nested inside another would report everything under it twice.
  // Sorting with a trailing separator puts every descendant of a root in one
  // block directly after it, so a root can only be nested inside the last
  // covering one: without it `src-electron` sorts between `src` and `src/lib`,
  // because `-` is below `/`. That invariant keeps this pass linear.
  const kept: string[] = [];
  let cover: string | undefined;
  // Sorted on the real path, so a `src` that links to `apps/web` is seen to
  // contain a root declared as `apps/web/src`. The unresolved path is what is
  // returned, so the files keep the names the project uses for them.
  const order = usable
    .map((dir) => ({ dir, real: realOf.get(dir) ?? dir }))
    .sort((a, b) => (a.real + sep < b.real + sep ? -1 : a.real === b.real ? 0 : 1));
  for (const { dir, real } of order) {
    if (cover !== undefined && !escapes(relative(cover, real))) {
      // The walk refuses to descend into a generated directory, so a project
      // declared below one is only reachable by starting there.
      const crosses = relative(cover, real)
        .split(/[\\/]/)
        .some((part, depth) => skipsDirectory(part, depth === 0));
      if (!crosses) continue;
      kept.push(dir);
      continue;
    }
    kept.push(dir);
    cover = real;
  }
  return kept;
}

/** Directories holding third-party code, never scanned even when declared. */
export const DEPENDENCY_DIRS = new Set(['node_modules', '.git', '.yarn']);

/** Directories that never hold project source. */
export const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out-tsc',
  'coverage',
  'tmp',
  '.angular',
  '.git',
  '.nx',
  '.cache',
  '.turbo',
  '.yarn',
]);

const GENERATED_DIRS = new Set(['dist', 'build', 'out-tsc', 'coverage', 'tmp']);

function skipsDirectory(name: string, top: boolean): boolean {
  const lower = name.toLowerCase();
  if (!IGNORED_DIRS.has(lower)) return false;
  return top || !GENERATED_DIRS.has(lower);
}

/**
 * Calls `visit` with the path and name of every file under `dir`, skipping
 * `IGNORED_DIRS` and unreadable entries. Symbolic links are not followed: a
 * link can point anywhere, including outside the workspace. `visit` returns
 * `false` to end the walk, and `maxDepth` bounds how many directory levels
 * below `dir` are read.
 */
export function walkFiles(
  dir: string,
  visit: (full: string, name: string) => boolean | void,
  maxDepth = Infinity,
  top = true,
): boolean {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return true;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const stats = lstatSync(full);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        if (maxDepth > 0 && !skipsDirectory(entry, top)) {
          if (!walkFiles(full, visit, maxDepth - 1, false)) return false;
        }
        continue;
      }
    } catch {
      continue;
    }
    if (visit(full, entry) === false) return false;
  }
  return true;
}

/**
 * JSONC as plain JSON: comments gone and trailing commas dropped. The commas
 * are located in a masked copy, so a `,}` inside a path stays untouched.
 */
function parseJsonc(source: string): string {
  const text = stripComments(source);
  const masked = maskStrings(text);
  const trailing = /,(\s*[}\]])/g;
  let out = '';
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = trailing.exec(masked)) !== null) {
    out += text.slice(last, match.index);
    last = match.index + 1;
  }
  return out + text.slice(last);
}

/**
 * Whether a relative path leaves its base. A plain `startsWith('..')` also
 * matches a child named `..foo`, which does not.
 */
export function escapes(rel: string): boolean {
  return rel === '..' || rel.startsWith('..' + sep);
}

/** The path with symlinks resolved, or the path itself when it does not exist. */
export function realPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
