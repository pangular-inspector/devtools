import { Component, ElementRef, inject } from '@angular/core';
import { plural } from '../../format';
import { SourceLink } from '../../ui/source-link';
import { AnalogContentPreview } from '../analog-content-preview';
import { base, dir } from './analog-model';
import { AnalogPageState } from './analog-page-state';

/** The Content view of the Analog page: the markdown files, the content schema and the preview. */
@Component({
  selector: 'div[appAnalogContent]',
  imports: [SourceLink, AnalogContentPreview],
  templateUrl: './analog-content.html',
  styleUrl: './analog-content.scss',
})
export class AnalogContent {
  private readonly page = inject(AnalogPageState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly plural = plural;
  protected readonly rpc = this.page.rpc;
  protected readonly project = this.page.project;
  protected readonly previewFile = this.page.previewFile;
  protected readonly dir = dir;
  protected readonly base = base;

  protected shadowed(file: string): string | undefined {
    const finding = this.page
      .findings()
      .find((f) => f.rule === 'content-shadows-page' && f.file === file);
    return finding?.relatedFile;
  }

  protected contentUrl(file: string): string | undefined {
    return this.page.allRoutes().find((r) => r.route.file === file)?.route.fullPath;
  }

  protected showPreview(file: string) {
    this.previewFile.set(this.previewFile() === file ? null : file);
  }

  protected closePreview(file: string) {
    this.previewFile.set(null);
    this.refocus(`Preview ${file}`);
  }

  /** Hands focus back to the row button that opened a detail card. */
  private refocus(label: string) {
    queueMicrotask(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(`button[aria-label="${CSS.escape(label)}"]`)
        ?.focus(),
    );
  }
}
