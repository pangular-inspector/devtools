import { Component, ElementRef, computed, inject } from '@angular/core';
import { rpcCall } from '../../rpc';
import { SearchField } from '../../ui/search-field';
import { SourceLink } from '../../ui/source-link';
import { AnalogTransform } from '../analog-transform';
import { base, dir, short, type AnalogRoute, type UrlMatch } from './analog-model';
import { AnalogPageState } from './analog-page-state';

/** The Routes view of the Analog page: the URL tester and the file route table. */
@Component({
  selector: 'div[appAnalogRoutes]',
  imports: [SearchField, SourceLink, AnalogTransform],
  templateUrl: './analog-routes.html',
  styleUrl: './analog-routes.scss',
})
export class AnalogRoutes {
  private readonly page = inject(AnalogPageState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rpc = this.page.rpc;
  protected readonly serverFns = this.page.serverFns;
  protected readonly filter = this.page.filter;
  protected readonly testUrl = this.page.testUrl;
  protected readonly explained = this.page.explained;
  protected readonly explainError = this.page.explainError;
  protected readonly explaining = this.page.explaining;
  protected readonly transformFile = this.page.transformFile;
  protected readonly short = short;
  protected readonly dir = dir;
  protected readonly base = base;

  protected readonly routeRows = computed(() => {
    const needle = this.filter().trim().toLowerCase();
    if (!needle) return this.page.allRoutes();
    return this.page
      .allRoutes()
      .filter(
        (r) =>
          r.route.fullPath.toLowerCase().includes(needle) ||
          !!r.route.file?.toLowerCase().includes(needle),
      );
  });

  protected isOpen(route: AnalogRoute): boolean {
    return this.page.isOpen(route);
  }

  protected openText(route: AnalogRoute): string {
    return this.page.openText(route);
  }

  protected kindText(route: AnalogRoute): string {
    if (route.catchAll) return route.catchAll === 'optional' ? 'optional catch-all' : 'catch-all';
    if (route.kind === 'implicit') return 'folder';
    return route.kind;
  }

  protected serverExports(route: AnalogRoute): string[] {
    return (route.serverExports ?? []).filter((e) => e === 'load' || e === 'action');
  }

  protected paramList(params: Record<string, string>): [string, string][] {
    return Object.entries(params);
  }

  protected showTransform(file: string) {
    this.transformFile.set(this.transformFile() === file ? null : file);
  }

  protected closeTransform(file: string) {
    this.transformFile.set(null);
    this.refocus(`Show the Vite transform stack of ${file}`);
  }

  /** Hands focus back to the row button that opened a detail card. */
  private refocus(label: string) {
    queueMicrotask(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(`button[aria-label="${CSS.escape(label)}"]`)
        ?.focus(),
    );
  }

  protected async explain() {
    const url = this.testUrl().trim();
    if (!url) {
      this.explained.set(null);
      this.explainError.set('Type a URL to explain, for example /products/42.');
      return;
    }
    this.explaining.set(true);
    this.explainError.set('');
    try {
      const match = (await rpcCall(this.rpc(), 'analog-explain-url', url)) as UrlMatch | null;
      if (!match) throw new Error('The devtools server did not answer');
      this.explained.set({ url, match });
    } catch (error) {
      const reason = String((error as Error)?.message || 'The devtools server did not answer');
      this.explained.set(null);
      this.explainError.set(`Could not explain ${url}. ${reason.replace(/\.?$/, '.')}`);
    } finally {
      this.explaining.set(false);
    }
  }
}
