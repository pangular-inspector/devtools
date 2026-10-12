/**
 * An action for the Components tab to run, from the command palette or the
 * hub's. A new object each time, so running the same command again counts.
 */
export interface ComponentCommand {
  kind: 'pick' | 'cd-start' | 'cd-stop' | 'cd-clear';
}
