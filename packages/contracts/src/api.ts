/**
 * HTTP surface. Commands go over REST, state changes come back over the
 * WebSocket (see realtime.ts for the socket protocol).
 *
 *   GET    /api/menu                     -> MenuSnapshot
 *   GET    /api/orders                   -> OrdersSnapshot
 *   GET    /api/orders/:id               -> Order
 *   POST   /api/orders                   -> 201 Order | 200 Order (idempotent replay)
 *                                           | 409 MenuChangedError
 *   WS     /api/ws                       -> ServerMessage stream, see realtime.ts
 *
 *   POST   /api/setup/categories         -> 201 Category
 *   PATCH  /api/setup/categories/:id     -> Category | 409 VersionConflictError
 *   DELETE /api/setup/categories/:id     -> 204
 *   POST   /api/setup/items              -> 201 MenuItem
 *   PATCH  /api/setup/items/:id          -> MenuItem | 409 VersionConflictError
 *   DELETE /api/setup/items/:id          -> 204
 *
 * Sequencing: each snapshot carries the `seq` it reflects. While a domain
 * loads its snapshot it buffers incoming events; afterwards it applies only
 * events with seq > snapshot seq. Nothing is lost or applied twice, whatever
 * order the snapshot response and live events arrive in.
 */
export const API = {
  menu: '/api/menu',
  orders: '/api/orders',
  order: (id: string) => `/api/orders/${encodeURIComponent(id)}`,
  ws: '/api/ws',
  setupCategories: '/api/setup/categories',
  setupCategory: (id: string) => `/api/setup/categories/${encodeURIComponent(id)}`,
  setupItems: '/api/setup/items',
  setupItem: (id: string) => `/api/setup/items/${encodeURIComponent(id)}`,
} as const;

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
