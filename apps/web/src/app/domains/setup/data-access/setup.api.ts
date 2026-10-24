import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import {
  API,
  type Category,
  type CategoryId,
  type CreateCategoryRequest,
  type CreateItemRequest,
  type ItemId,
  type MenuItem,
  type UpdateCategoryRequest,
  type UpdateItemRequest,
} from '@restaurant/contracts';

@Injectable({ providedIn: 'root' })
export class SetupApi {
  private readonly http = inject(HttpClient);

  createCategory(request: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(API.setupCategories, request);
  }

  updateCategory(id: CategoryId, request: UpdateCategoryRequest): Observable<Category> {
    return this.http.patch<Category>(API.setupCategory(id), request);
  }

  deleteCategory(id: CategoryId): Observable<void> {
    return this.http.delete<void>(API.setupCategory(id));
  }

  createItem(request: CreateItemRequest): Observable<MenuItem> {
    return this.http.post<MenuItem>(API.setupItems, request);
  }

  updateItem(id: ItemId, request: UpdateItemRequest): Observable<MenuItem> {
    return this.http.patch<MenuItem>(API.setupItem(id), request);
  }
}
