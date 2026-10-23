import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { API, type MenuSnapshot } from '@restaurant/contracts';

@Injectable({ providedIn: 'root' })
export class MenuApi {
  private readonly http = inject(HttpClient);

  snapshot(): Observable<MenuSnapshot> {
    return this.http.get<MenuSnapshot>(API.menu);
  }
}
