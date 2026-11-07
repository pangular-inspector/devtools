export declare const LINT_PATHS: string[];
export declare function countDiagnostics(
  diagnostics: { filename: string; code?: string }[],
  root?: string,
): Record<string, Record<string, number>>;
export declare function compareCounts(
  baseline: Record<string, Record<string, number>>,
  current: Record<string, Record<string, number>>,
): { added: string[]; fixed: string[] };
