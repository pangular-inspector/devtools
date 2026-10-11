import { inject } from '@angular/core';
import { Router, type CanActivateFn, type ResolveFn } from '@angular/router';

export const adminGuard: CanActivateFn = () =>
  inject(Router).parseUrl('/examples/routes/summary?from=admin');

export const lockedGuard: CanActivateFn = () => false;

export const userResolver: ResolveFn<{ id: string; name: string }> = (route) =>
  new Promise((resolve) =>
    setTimeout(() => resolve({ id: route.paramMap.get('id') ?? '', name: 'Ada Lovelace' }), 300),
  );

export const brokenResolver: ResolveFn<never> = () => {
  throw new Error('report service is down');
};

const LOOP_HOPS = 6;
let loopHops = 0;

function bouncingGuard(to: string): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (++loopHops >= LOOP_HOPS) {
      loopHops = 0;
      return router.parseUrl('/examples/routes/summary?from=loop');
    }
    return router.parseUrl(to);
  };
}

export const loopAGuard = bouncingGuard('/examples/routes/loop-b');
export const loopBGuard = bouncingGuard('/examples/routes/loop-a');
