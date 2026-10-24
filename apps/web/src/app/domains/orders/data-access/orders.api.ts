import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { API, type OrdersSnapshot } from '@restaurant/contracts';

@Injectable({ providedIn: 'root' })
export class OrdersListApi {
  private readonly http = inject(HttpClient);

  snapshot(): Observable<OrdersSnapshot> {
    return this.http.get<OrdersSnapshot>(API.orders);
  }
}
