// The published `@pangular-inspector/devtools/cli` entry: `createPangularCli()`, the `pangular`
// command line, to run it from a script, and `buildReport()`, the `build` command as a function.
export { createPangularCli, type PangularCliOptions } from '../cli.ts';
export {
  buildReport,
  DEFAULT_REPORT_DIR,
  type BuildReportOptions,
  type BuildReportResult,
} from '../build-report.ts';
