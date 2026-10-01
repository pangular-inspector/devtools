import { Routes } from '@angular/router';
import {
  adminGuard,
  brokenResolver,
  lockedGuard,
  loopAGuard,
  loopBGuard,
  userResolver,
} from './route-guards';

/**
 * Deliberately varied: children, grandchildren, a redirect, route data and a
 * lazily loaded child configuration, so the Routes inspector has something to
 * show beyond a flat list.
 */
export const examplesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./examples-overview').then((m) => m.ExamplesOverview),
    data: { title: 'Overview' },
  },
  {
    path: 'signals',
    loadComponent: () => import('./signals-example').then((m) => m.SignalsExample),
    data: { title: 'Signals', inspector: 'signals' },
  },
  {
    path: 'components',
    loadComponent: () => import('./components-example').then((m) => m.ComponentsExample),
    data: { title: 'Components', inspector: 'components' },
  },
  {
    path: 'pipes',
    loadComponent: () => import('./pipes-example').then((m) => m.PipesExample),
    data: { title: 'Pipes', inspector: 'pipes' },
  },
  {
    path: 'di',
    loadComponent: () => import('./di-example').then((m) => m.DiExample),
    data: { title: 'Injectors', inspector: 'injectors' },
  },
  {
    path: 'routes',
    loadComponent: () => import('./routes-example').then((m) => m.RoutesExample),
    data: { title: 'Routes', inspector: 'routes' },
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      {
        path: 'summary',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        data: { title: 'Summary', depth: 3 },
      },
      {
        path: 'details',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        data: { title: 'Details', depth: 3 },
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        data: { title: 'User', depth: 3 },
        resolve: { user: userResolver },
      },
      {
        path: 'admin',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        canActivate: [adminGuard],
        data: { title: 'Admin' },
      },
      {
        path: 'locked',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        canActivate: [lockedGuard],
        data: { title: 'Locked' },
      },
      {
        path: 'broken',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        resolve: { report: brokenResolver },
        data: { title: 'Broken' },
      },
      {
        path: 'loop-a',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        canActivate: [loopAGuard],
        data: { title: 'Guard loop A' },
      },
      {
        path: 'loop-b',
        loadComponent: () => import('./route-panel').then((m) => m.RoutePanel),
        canActivate: [loopBGuard],
        data: { title: 'Guard loop B' },
      },
    ],
  },
  {
    path: 'forms',
    loadComponent: () => import('./forms-example').then((m) => m.FormsExample),
    data: { title: 'Forms', inspector: 'forms' },
  },
  {
    path: 'http',
    loadComponent: () => import('./http-example').then((m) => m.HttpExample),
    data: { title: 'SSR & HTTP', inspector: 'network' },
  },
  {
    path: 'store',
    loadComponent: () => import('./store-example').then((m) => m.StoreExample),
    data: { title: 'NgRx', inspector: 'store' },
  },
  {
    path: 'defer',
    loadComponent: () => import('./defer-example').then((m) => m.DeferExample),
    data: { title: 'Defer blocks', inspector: 'components' },
  },
  { path: 'injectors', redirectTo: 'di', pathMatch: 'full' },
];
