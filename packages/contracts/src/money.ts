/**
 * All amounts are integers in minor units (cents).
 * Never use floats for money; format only at the UI edge.
 */
export type Minor = number;

export const CURRENCY = 'USD' as const;
