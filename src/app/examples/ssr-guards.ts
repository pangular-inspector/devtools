import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type CanActivateFn, type ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface Access {
  allowed: boolean;
  soldOut?: boolean;
}

/** Asks the API whether the product can be shown; the call shows up under the guard's navigation. */
export const productAccessGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const id = route.paramMap.get('id') ?? '';
  return inject(HttpClient)
    .get<Access>(`/api/access/${encodeURIComponent(id)}?delay=150`)
    .pipe(
      map((access) => {
        if (access.allowed) return true;
        if (access.soldOut) return router.parseUrl('/examples/ssr/product/1?from=sold-out');
        return false;
      }),
      catchError(() => of(false)),
    );
};

/** A slow API call, so the resolve phase has a visible time. */
export const productResolver: ResolveFn<Product> = (route) =>
  inject(HttpClient).get<Product>(
    `/api/products/${encodeURIComponent(route.paramMap.get('id') ?? '')}?delay=400`,
  );
