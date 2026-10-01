import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'destinations', renderMode: RenderMode.Server },
  { path: 'destinations/:id', renderMode: RenderMode.Server },
  { path: 'book/:id', renderMode: RenderMode.Client },
  { path: 'trips', renderMode: RenderMode.Client },
  { path: 'sign-in', renderMode: RenderMode.Client },
  { path: 'examples/routes/users/:id', renderMode: RenderMode.Client },
  { path: 'examples/routes/admin', renderMode: RenderMode.Client },
  { path: 'examples/routes/locked', renderMode: RenderMode.Client },
  { path: 'examples/routes/broken', renderMode: RenderMode.Client },
  { path: 'examples/routes/loop-a', renderMode: RenderMode.Client },
  { path: 'examples/routes/loop-b', renderMode: RenderMode.Client },
  // Rendered per request so SSR calls /api/products live and fault rules apply.
  { path: 'examples/http', renderMode: RenderMode.Server },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
