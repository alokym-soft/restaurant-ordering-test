/**
 * All amounts are integers in minor units (kopiyky / cents).
 * Never use floats for money; format only at the UI edge.
 */
export type Minor = number;

export const CURRENCY = 'UAH' as const;
