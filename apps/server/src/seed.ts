import type { Category, MenuItem, Pricing } from '@restaurant/contracts';

/** Small, fast, seedable PRNG (mulberry32). Same seed → same menu on every start. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const CATEGORY_NAMES = [
  'Breakfast', 'Soups', 'Salads', 'Starters', 'Burgers', 'Sandwiches', 'Pizza', 'Pasta', 'Risotto',
  'Steaks', 'Grill', 'Seafood', 'Sushi', 'Rolls', 'Ramen', 'Curries', 'Dumplings', 'Vegetarian',
  'Vegan', 'Kids', 'Sides', 'Sauces', 'Bakery', 'Desserts', 'Ice Cream', 'Coffee', 'Tea',
  'Smoothies', 'Lemonades', 'Specials',
];

const ADJECTIVES = [
  'Classic', 'Smoky', 'Spicy', 'Crispy', 'Garden', 'Golden', 'Rustic', 'Creamy', 'Zesty', 'Hearty',
  'Grilled', 'Roasted', 'Fresh', 'Homemade', 'Signature', 'Wild', 'Honey', 'Truffle', 'Lemon', 'Herb',
];

const NOUNS = [
  'Chicken', 'Beef', 'Salmon', 'Tuna', 'Mushroom', 'Tomato', 'Pumpkin', 'Lamb', 'Duck', 'Shrimp',
  'Cheese', 'Avocado', 'Spinach', 'Potato', 'Eggplant', 'Pork', 'Tofu', 'Lentil', 'Chickpea', 'Berry',
];

const SUFFIXES = ['Bowl', 'Plate', 'Special', 'Combo', 'Deluxe', 'Mini', 'Feast', 'Duo', 'Classic', 'Light'];

export interface SeedOptions {
  seed?: number;
  categories?: number;
  itemsPerCategory?: number;
}

export interface SeedData {
  categories: Category[];
  items: MenuItem[];
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/**
 * Deterministic demo menu: 30 categories × 100 items by default (3000 items),
 * about 10% open-price and about 5% unavailable items.
 */
export function generateSeed({ seed = 20261023, categories = 30, itemsPerCategory = 100 }: SeedOptions = {}): SeedData {
  const random = createRandom(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));

  const resultCategories: Category[] = [];
  const resultItems: MenuItem[] = [];

  for (let c = 0; c < categories; c++) {
    const categoryId = `cat-${pad(c + 1, 3)}`;
    const categoryName = CATEGORY_NAMES[c % CATEGORY_NAMES.length] ?? `Category ${c + 1}`;
    resultCategories.push({ id: categoryId, name: categoryName, sortOrder: (c + 1) * 10, version: 1 });

    for (let i = 0; i < itemsPerCategory; i++) {
      const n = c * itemsPerCategory + i + 1;
      const isOpen = random() < 0.1;
      // Prices in minor units, rounded to 5 UAH.
      const pricing: Pricing = isOpen
        ? (() => {
            const min = between(4, 20) * 500;
            return { kind: 'open', min, max: min + between(4, 40) * 500 };
          })()
        : { kind: 'fixed', price: between(8, 120) * 500 };
      const name = `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(SUFFIXES)}`;
      const item: MenuItem = {
        id: `item-${pad(n, 5)}`,
        categoryId,
        name: isOpen ? `${name} (your price)` : name,
        pricing,
        available: random() >= 0.05,
        sortOrder: (i + 1) * 10,
        version: 1,
      };
      if (random() < 0.6) item.description = `${categoryName} favourite, made to order.`;
      resultItems.push(item);
    }
  }

  return { categories: resultCategories, items: resultItems };
}
