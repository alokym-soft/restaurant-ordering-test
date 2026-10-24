import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { API, type CreateOrderRequest, IDEMPOTENCY_HEADER, type Order } from '@restaurant/contracts';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  /** Safe to repeat with the same key: the server returns the order it already created. */
  create(request: CreateOrderRequest, idempotencyKey: string): Observable<Order> {
    return this.http.post<Order>(API.orders, request, {
      headers: new HttpHeaders({ [IDEMPOTENCY_HEADER]: idempotencyKey }),
    });
  }
}
