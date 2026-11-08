export declare const LINT_PATHS: string[];
export declare const MAX_LINES: number;
export declare const LINE_PATHS: string[];
export declare const MAX_LINES_RULE: string;
export declare function lineDiagnostics(
  files: { file: string; lines: number }[],
  max?: number,
): { filename: string; code: string; count: number; message: string }[];
export declare function countDiagnostics(
  diagnostics: { filename: string; code?: string; count?: number }[],
  root?: string,
): Record<string, Record<string, number>>;
export declare function compareCounts(
  baseline: Record<string, Record<string, number>>,
  current: Record<string, Record<string, number>>,
): { added: string[]; fixed: string[] };
