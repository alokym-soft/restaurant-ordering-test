import type {
  CreateCategoryRequest,
  CreateItemRequest,
  CreateOrderRequest,
  FieldError,
  OrderLineRequest,
  Pricing,
  UpdateCategoryRequest,
  UpdateItemRequest,
} from '@restaurant/contracts';
import { validationFailed } from './errors.js';

/**
 * Hand-written request validation. Each parser returns a clean, typed object or throws a
 * `VALIDATION_FAILED` error listing every invalid field.
 */

export const LIMITS = {
  nameMax: 100,
  descriptionMax: 500,
  quantityMin: 1,
  quantityMax: 99,
  linesMax: 200,
  /** $1,000,000 in minor units (cents). */
  amountMax: 100_000_000,
} as const;

type Raw = Record<string, unknown>;

class Fields {
  readonly errors: FieldError[] = [];

  constructor(private readonly body: Raw) {}

  add(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  has(key: string): boolean {
    return this.body[key] !== undefined;
  }

  string(key: string, { required, max }: { required: boolean; max: number }): string | undefined {
    const value = this.body[key];
    if (value === undefined) {
      if (required) this.add(key, 'is required');
      return undefined;
    }
    if (typeof value !== 'string') {
      this.add(key, 'must be a string');
      return undefined;
    }
    const trimmed = value.trim();
    if (required && trimmed.length === 0) this.add(key, 'must not be empty');
    else if (trimmed.length > max) this.add(key, `must be at most ${max} characters`);
    return trimmed;
  }

  integer(key: string, { required, min, max }: { required: boolean; min?: number; max?: number }): number | undefined {
    return checkInteger(this, key, this.body[key], { required, min, max });
  }

  boolean(key: string): boolean | undefined {
    const value = this.body[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      this.add(key, 'must be true or false');
      return undefined;
    }
    return value;
  }

  done<T>(value: T): T {
    if (this.errors.length > 0) throw validationFailed(this.errors);
    return value;
  }
}

function checkInteger(
  fields: Fields,
  field: string,
  value: unknown,
  { required, min, max }: { required: boolean; min?: number; max?: number },
): number | undefined {
  if (value === undefined) {
    if (required) fields.add(field, 'is required');
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    fields.add(field, 'must be an integer');
    return undefined;
  }
  if (min !== undefined && value < min) fields.add(field, `must be at least ${min}`);
  if (max !== undefined && value > max) fields.add(field, `must be at most ${max}`);
  return value;
}

function asObject(body: unknown): Raw {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validationFailed([{ field: 'body', message: 'must be a JSON object' }]);
  }
  return body as Raw;
}

function parsePricing(fields: Fields, value: unknown, field = 'pricing'): Pricing | undefined {
  if (typeof value !== 'object' || value === null) {
    fields.add(field, 'must be an object');
    return undefined;
  }
  const raw = value as Raw;
  const amount = { required: true, min: 0, max: LIMITS.amountMax };
  if (raw['kind'] === 'fixed') {
    const price = checkInteger(fields, `${field}.price`, raw['price'], amount);
    return price === undefined ? undefined : { kind: 'fixed', price };
  }
  if (raw['kind'] === 'open') {
    const min = checkInteger(fields, `${field}.min`, raw['min'], amount);
    const max = checkInteger(fields, `${field}.max`, raw['max'], { ...amount, min: 1 });
    if (min === undefined || max === undefined) return undefined;
    if (min > max) {
      fields.add(`${field}.max`, 'must be greater than or equal to min');
      return undefined;
    }
    return { kind: 'open', min, max };
  }
  fields.add(`${field}.kind`, 'must be "fixed" or "open"');
  return undefined;
}

export function parseCreateCategory(body: unknown): CreateCategoryRequest {
  const fields = new Fields(asObject(body));
  const name = fields.string('name', { required: true, max: LIMITS.nameMax });
  const sortOrder = fields.integer('sortOrder', { required: false });
  return fields.done({ name: name ?? '', ...(sortOrder !== undefined && { sortOrder }) });
}

export function parseUpdateCategory(body: unknown): UpdateCategoryRequest {
  const fields = new Fields(asObject(body));
  const expectedVersion = fields.integer('expectedVersion', { required: true, min: 1 });
  const name = fields.has('name') ? fields.string('name', { required: true, max: LIMITS.nameMax }) : undefined;
  const sortOrder = fields.integer('sortOrder', { required: false });
  return fields.done({
    expectedVersion: expectedVersion ?? 0,
    ...(name !== undefined && { name }),
    ...(sortOrder !== undefined && { sortOrder }),
  });
}

export function parseCreateItem(body: unknown): CreateItemRequest {
  const raw = asObject(body);
  const fields = new Fields(raw);
  const categoryId = fields.string('categoryId', { required: true, max: LIMITS.nameMax });
  const name = fields.string('name', { required: true, max: LIMITS.nameMax });
  const description = fields.string('description', { required: false, max: LIMITS.descriptionMax });
  const pricing = raw['pricing'] === undefined ? (fields.add('pricing', 'is required'), undefined) : parsePricing(fields, raw['pricing']);
  const available = fields.boolean('available');
  const sortOrder = fields.integer('sortOrder', { required: false });
  return fields.done({
    categoryId: categoryId ?? '',
    name: name ?? '',
    pricing: pricing as Pricing,
    ...(description && { description }),
    ...(available !== undefined && { available }),
    ...(sortOrder !== undefined && { sortOrder }),
  });
}

export function parseUpdateItem(body: unknown): UpdateItemRequest {
  const raw = asObject(body);
  const fields = new Fields(raw);
  const expectedVersion = fields.integer('expectedVersion', { required: true, min: 1 });
  const categoryId = fields.has('categoryId') ? fields.string('categoryId', { required: true, max: LIMITS.nameMax }) : undefined;
  const name = fields.has('name') ? fields.string('name', { required: true, max: LIMITS.nameMax }) : undefined;
  // An empty description removes it.
  const description = fields.string('description', { required: false, max: LIMITS.descriptionMax });
  const pricing = raw['pricing'] === undefined ? undefined : parsePricing(fields, raw['pricing']);
  const available = fields.boolean('available');
  const sortOrder = fields.integer('sortOrder', { required: false });
  return fields.done({
    expectedVersion: expectedVersion ?? 0,
    ...(categoryId !== undefined && { categoryId }),
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(pricing !== undefined && { pricing }),
    ...(available !== undefined && { available }),
    ...(sortOrder !== undefined && { sortOrder }),
  });
}

export function parseCreateOrder(body: unknown): CreateOrderRequest {
  const raw = asObject(body);
  const fields = new Fields(raw);
  const discount = fields.integer('discount', { required: true, min: 0, max: LIMITS.amountMax });
  const linesValue = raw['lines'];
  const lines: OrderLineRequest[] = [];

  if (!Array.isArray(linesValue) || linesValue.length === 0) {
    fields.add('lines', 'must contain at least one line');
  } else if (linesValue.length > LIMITS.linesMax) {
    fields.add('lines', `must contain at most ${LIMITS.linesMax} lines`);
  } else {
    linesValue.forEach((value: unknown, index) => {
      const field = `lines[${index}]`;
      if (typeof value !== 'object' || value === null) {
        fields.add(field, 'must be an object');
        return;
      }
      const line = value as Raw;
      const itemId = line['itemId'];
      if (typeof itemId !== 'string' || itemId.length === 0) fields.add(`${field}.itemId`, 'is required');
      const quantity = checkInteger(fields, `${field}.quantity`, line['quantity'], {
        required: true,
        min: LIMITS.quantityMin,
        max: LIMITS.quantityMax,
      });
      const unitPrice = checkInteger(fields, `${field}.unitPrice`, line['unitPrice'], {
        required: true,
        min: 0,
        max: LIMITS.amountMax,
      });
      const itemVersion = checkInteger(fields, `${field}.itemVersion`, line['itemVersion'], { required: true, min: 1 });
      if (typeof itemId === 'string' && quantity !== undefined && unitPrice !== undefined && itemVersion !== undefined) {
        lines.push({ itemId, quantity, unitPrice, itemVersion });
      }
    });
  }

  return fields.done({ lines, discount: discount ?? 0 });
}
