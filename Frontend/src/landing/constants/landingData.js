import { TrendingUp, Store, CloudLightning, BadgeDollarSign, Building2, Utensils, Coffee, Crown, Star } from 'lucide-react';

/* ─── Testimonials Data ──────────────────────────────────────────── */

export const STATS = [
  { id: 1, value: 3, suffix: 'M+', label: 'Orders Processed', icon: TrendingUp },
  { id: 2, value: 15, suffix: 'k+', label: 'Partner Restaurants', icon: Store },
  { id: 3, value: 400, prefix: '$', suffix: 'M+', label: 'Revenue Managed', icon: BadgeDollarSign },
  { id: 4, value: 99, suffix: '%', label: 'Cloud Uptime', icon: CloudLightning },
];

export const REVIEWS = [
  {
    id: 1,
    name: 'Marco Rossi',
    role: 'Executive Chef & Owner',
    restaurant: 'Osteria Del Mare',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=200&q=85&auto=format&fit=crop',
    text: 'MS Billings completely transformed our kitchen flow. The KDS integration means our chefs never miss a beat, and the analytics dashboard gives me insights I didn\'t even know I needed. It is truly the backbone of our operation.',
    isFeatured: true
  },
  {
    id: 2,
    name: 'Sarah Chen',
    role: 'General Manager',
    restaurant: 'The Artisan Cafe',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=85&auto=format&fit=crop',
    text: 'The speed of the POS is unmatched. During our morning rush, every second counts. Since switching, our table turnover has improved by 25%.'
  },
  {
    id: 3,
    name: 'David Thompson',
    role: 'Operations Director',
    restaurant: 'Steakhouse 99',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=85&auto=format&fit=crop',
    text: 'Managing inventory used to be a nightmare. Now, stock depletes in real-time as dishes are sold. The ROI on this software was immediate.'
  }
];

/* ─── Gallery Data ───────────────────────────────────────────────── */

export const GALLERY_IMAGES = {
  main: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&q=85&auto=format&fit=crop', // Fine dining interior wide
  tall1: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=85&auto=format&fit=crop', // Chef cooking
  tall2: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85&auto=format&fit=crop', // Table setup
  wide: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=85&auto=format&fit=crop', // Cozy restaurant vibe
  square1: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&q=85&auto=format&fit=crop', // Coffee pouring
  square2: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=85&auto=format&fit=crop', // Dessert/Food
};

export const TRUST_LOGOS = [
  { name: 'The Grand', icon: Building2 },
  { name: 'Le Petit', icon: Utensils },
  { name: 'Artisan Roast', icon: Coffee },
  { name: 'Royal Dining', icon: Crown },
  { name: 'Michelin Star', icon: Star }
];

/* ─── Food Showcase Data ─────────────────────────────────────────── */

export const FOOD_SHOWCASE_IMAGES = {
  feature:    'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=1600&q=85&auto=format&fit=crop', // Royal Biryani
  support1:   'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=900&q=85&auto=format&fit=crop',  // Premium Steak
  support2:   'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900&q=85&auto=format&fit=crop',  // Truffle Pasta
  cinematic:  'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=2000&q=85&auto=format&fit=crop', // Chef Plating Macro
  split1:     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1000&q=85&auto=format&fit=crop', // Gourmet Burger
  split2:     'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1000&q=85&auto=format&fit=crop', // Wood-fired Pizza
  masonry1:   'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=85&auto=format&fit=crop',  // Seafood
  masonry2:   'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=85&auto=format&fit=crop',  // Luxury Dessert
  masonry3:   'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=85&auto=format&fit=crop',  // Artisanal Coffee
};
