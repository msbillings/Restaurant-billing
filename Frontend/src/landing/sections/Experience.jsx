import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Zap,
  ChefHat,
  Package,
  BarChart3,
  Cloud,
  Receipt,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import './Experience.css';

/* ─── Data ──────────────────────────────────────────────────────── */

const FEATURE_CARDS = [
  {
    icon: Zap,
    title: 'Fast Order Processing',
    desc: 'Orders placed to kitchen in under 2 seconds. Zero delays, zero errors.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen Workflow',
    desc: 'Digital KDS keeps every station in perfect sync — rush hour included.',
  },
  {
    icon: Package,
    title: 'Inventory Control',
    desc: 'Real-time stock tracking with smart alerts before you run out.',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    desc: 'See revenue, top dishes, and table turnover at a glance — anytime.',
  },
  {
    icon: Cloud,
    title: 'Cloud Access',
    desc: 'Manage all locations from one dashboard. No hardware dependency.',
  },
  {
    icon: Receipt,
    title: 'Billing Speed',
    desc: 'Generate and print bills in 3 seconds flat. Split bills, taxes, tips.',
  },
  {
    icon: Users,
    title: 'Customer Management',
    desc: 'Build loyalty with purchase history, preferences, and feedback.',
  },
  {
    icon: TrendingUp,
    title: 'Restaurant Growth',
    desc: 'Data-driven insights that identify opportunities before you miss them.',
  },
];

const HIGHLIGHTS = [
  'Works offline — no internet? No problem.',
  'Handles 500+ orders per hour without slowdown.',
  'Multilingual support for diverse teams.',
  'Integrates with your existing payment gateway.',
];

const RESTAURANT_IMAGES = {
  main: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=85&auto=format&fit=crop',
  accent1: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=80&auto=format&fit=crop',
  accent2: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=400&q=80&auto=format&fit=crop',
};

/* ─── Animation helpers ─────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up') => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 40 : dir === 'down' ? -40 : 0,
    x: dir === 'left' ? 50 : dir === 'right' ? -50 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Feature Card ──────────────────────────────────────────────── */
const FeatureCard = memo(({ icon, title, desc, index }) => {
  const Icon = icon;
  return (
    <Motion.div
      className="exp-feat-card"
      {...inView(0.05 * index, 'up')}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      role="article"
      aria-label={title}
    >
      <div className="exp-feat-card__icon-wrap" aria-hidden="true">
        <Icon strokeWidth={1.5} size={20} />
      </div>
      <h3 className="exp-feat-card__title">{title}</h3>
      <p className="exp-feat-card__desc">{desc}</p>
    </Motion.div>
  );
});

/* ─── Experience ────────────────────────────────────────────────── */
const Experience = () => (
  <section id="experience" className="exp-section" aria-label="The Restaurant Experience">

    {/* Wave transition from Hero */}
    <div className="exp-wave" aria-hidden="true" />

    {/* ── Background decoration ─────────────────────────────────── */}
    <div className="exp-bg" aria-hidden="true">
      <div className="exp-bg__blob exp-bg__blob--1" />
      <div className="exp-bg__blob exp-bg__blob--2" />
      <div className="exp-bg__grid" />
    </div>
    <div className="landing-container">

      {/* ══ Section Label ══ */}
      <Motion.div className="exp-label-row" {...inView(0)}>
        <span className="exp-label">The Restaurant Experience</span>
      </Motion.div>

      {/* ══ SPLIT LAYOUT: Visual LEFT — Copy RIGHT ══ */}
      <div className="exp-split">

        {/* ── Left: Cinematic Visual Composition ─────────────────── */}
        <Motion.div className="exp-visual" {...inView(0.1, 'right')}>

          {/* Glow halo */}
          <div className="exp-visual__glow" aria-hidden="true" />

          {/* Main restaurant image */}
          <div className="exp-visual__main">
            <img
              src={RESTAURANT_IMAGES.main}
              alt="Luxury restaurant dining room with warm ambient lighting"
              loading="lazy"
              decoding="async"
            />
            <div className="exp-visual__main-overlay" aria-hidden="true" />
          </div>

          {/* Accent image — top right */}
          <Motion.div
            className="exp-visual__accent exp-visual__accent--1"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <img
              src={RESTAURANT_IMAGES.accent1}
              alt="Chef at work"
              loading="lazy"
              decoding="async"
            />
          </Motion.div>

          {/* Accent image — bottom left */}
          <Motion.div
            className="exp-visual__accent exp-visual__accent--2"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 7.5, delay: 1, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <img
              src={RESTAURANT_IMAGES.accent2}
              alt="Premium dining setup"
              loading="lazy"
              decoding="async"
            />
          </Motion.div>

          {/* Floating stat card */}
          <Motion.div
            className="exp-stat-card"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-label="500 orders processed daily"
          >
            <span className="exp-stat-card__num">500+</span>
            <span className="exp-stat-card__lbl">Orders / Day</span>
          </Motion.div>

          {/* Floating rating card */}
          <Motion.div
            className="exp-rating-card"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 6, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-label="4.9 star restaurant rating"
          >
            <div className="exp-rating-card__stars" aria-hidden="true">
              {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
            </div>
            <span className="exp-rating-card__text">Avg Guest Rating</span>
          </Motion.div>

          {/* Decorative ring */}
          <div className="exp-visual__ring" aria-hidden="true" />
        </Motion.div>

        {/* ── Right: Copy ────────────────────────────────────────── */}
        <div className="exp-copy">

          <Motion.h2 className="exp-heading" {...inView(0.15, 'up')}>
            Every Great Restaurant
            <br />
            <span className="exp-heading__accent">Deserves Great Tools.</span>
          </Motion.h2>

          <Motion.p className="exp-body" {...inView(0.22, 'up')}>
            Restaurant owners pour their heart into every plate. Yet most
            still wrestle with slow billing, lost orders, and spreadsheets
            that never quite balance. The dining room deserves better.
          </Motion.p>

          <Motion.p className="exp-body" {...inView(0.28, 'up')}>
            MS Billings was designed in close collaboration with restaurant
            operators — from fine dining establishments to thriving cloud
            kitchens — to create software that feels as natural as service
            itself.
          </Motion.p>

          {/* Highlights list */}
          <Motion.ul className="exp-highlights" {...inView(0.34, 'up')} role="list">
            {HIGHLIGHTS.map((h, i) => (
              <li key={i} className="exp-highlights__item">
                <CheckCircle2 size={16} className="exp-highlights__icon" aria-hidden="true" />
                <span>{h}</span>
              </li>
            ))}
          </Motion.ul>

          {/* CTA */}
          <Motion.a
            href="/login"
            className="exp-cta"
            {...inView(0.42, 'up')}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Explore MS Billings features"
          >
            Explore Features
            <ArrowRight strokeWidth={1.5} size={16} aria-hidden="true" />
          </Motion.a>
        </div>
      </div>

      {/* ══ Feature Cards Grid ══ */}
      <Motion.div className="exp-feat-label-row" {...inView(0)}>
        <p className="exp-feat-eyebrow">What MS Billings Handles For You</p>
        <h2 className="exp-feat-heading">
          Every Operation.
          <span className="exp-feat-heading__gold"> One Platform.</span>
        </h2>
      </Motion.div>

      <div className="exp-feat-grid" role="list" aria-label="Platform features">
        {FEATURE_CARDS.map((card, i) => (
          <FeatureCard key={card.title} {...card} index={i} />
        ))}
      </div>

    </div>

    {/* Bottom transition */}
    <div className="exp-fade-bottom" aria-hidden="true" />
  </section>
);

export default Experience;
