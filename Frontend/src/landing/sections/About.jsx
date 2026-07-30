import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Monitor,
  Package,
  ChefHat,
  Receipt,
  BarChart3,
  Users,
  Smartphone,
  Shield,
  TrendingUp,
  Cloud,
  CheckCircle2,
  ArrowRight,
  Star,
} from 'lucide-react';
import './About.css';

/* ─── Data ──────────────────────────────────────────────────────── */

const MODULES = [
  { icon: Monitor,    title: 'Point of Sale',          desc: 'Touch-optimised POS built for speed in every service rush.' },
  { icon: Package,    title: 'Inventory',               desc: 'Real-time stock with smart depletion alerts and supplier reorder.' },
  { icon: ChefHat,    title: 'Kitchen Display',         desc: 'Digital KDS that keeps prep times and plating in perfect order.' },
  { icon: Receipt,    title: 'Smart Billing',           desc: 'GST-compliant bills, split payments, and UPI in under 3 seconds.' },
  { icon: BarChart3,  title: 'Reports & Analytics',     desc: 'Revenue, covers, wastage — every metric in one clean dashboard.' },
  { icon: Users,      title: 'Customer Management',     desc: 'Purchase history, preferences, loyalty programmes, feedback.' },
  { icon: Smartphone, title: 'Multi-Device Support',    desc: 'Phone, tablet, desktop. Operate from anywhere — even offline.' },
  { icon: Shield,     title: 'Role Management',         desc: 'Staff, manager, owner — precise access control for everyone.' },
  { icon: TrendingUp, title: 'Performance Tracking',    desc: 'Track staff performance, peak hours, and table efficiency.' },
  { icon: Cloud,      title: 'Cloud Ready',             desc: 'All data synced securely. Access from any device, any location.' },
];

const STATS = [
  { value: '10×',    label: 'Faster Billing',       sub: 'vs manual methods'         },
  { value: '99.9%',  label: 'Accuracy',             sub: 'across all transactions'   },
  { value: '< 3s',   label: 'Bill Generation',      sub: 'from order to receipt'     },
  { value: '24 / 7', label: 'Cloud Sync',           sub: 'zero downtime guarantee'   },
];

const ROW_1_BULLETS = [
  'One system for dine-in, takeaway, and delivery',
  'Multi-outlet management from a single dashboard',
  'Built-in GST & VAT compliance — zero manual tax work',
];

const ROW_2_BULLETS = [
  'Onboard your whole team in under 30 minutes',
  'Live customer data that drives repeat business',
  'Scales from a single café to a 50-outlet chain',
];

const VISUAL_1 =
  'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=700&q=85&auto=format&fit=crop';
const VISUAL_2 =
  'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=700&q=85&auto=format&fit=crop';

/* ─── Animation helpers ─────────────────────────────────────────── */
const inView = (delay = 0, dir = 'up') => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 38 : dir === 'down' ? -38 : 0,
    x: dir === 'left' ? 48 : dir === 'right' ? -48 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration: 0.78, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Sub-components ────────────────────────────────────────────── */

const StatCard = memo(({ value, label, sub, index }) => (
  <Motion.div
    className="ab-stat-card"
    {...inView(0.08 * index, 'up')}
    whileHover={{ y: -4, scale: 1.03 }}
    transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    aria-label={`${value} ${label}`}
  >
    <span className="ab-stat-card__val">{value}</span>
    <span className="ab-stat-card__label">{label}</span>
    <span className="ab-stat-card__sub">{sub}</span>
  </Motion.div>
));

const ModuleCard = memo(({ icon, title, desc, index }) => {
  const Icon = icon;
  return (
    <Motion.div
      className="ab-module-card"
      {...inView(0.04 * index, 'up')}
      whileHover={{ y: -5, scale: 1.025 }}
      transition={{ type: 'spring', stiffness: 250, damping: 22 }}
      role="article"
      aria-label={title}
    >
      <div className="ab-module-card__icon" aria-hidden="true">
        <Icon strokeWidth={1.5} size={18} />
      </div>
      <div>
        <h3 className="ab-module-card__title">{title}</h3>
        <p className="ab-module-card__desc">{desc}</p>
      </div>
    </Motion.div>
  );
});

/* ─── About ─────────────────────────────────────────────────────── */
const About = () => (
  <section id="about" className="ab-section" aria-label="About MS Billings">

    {/* Top transition */}
    <div className="ab-top-fade" aria-hidden="true" />

    {/* Background */}
    <div className="ab-bg" aria-hidden="true">
      <div className="ab-bg__blob ab-bg__blob--1" />
      <div className="ab-bg__blob ab-bg__blob--2" />
      <div className="ab-bg__blob ab-bg__blob--3" />
    </div>

    <div className="landing-container">

      {/* ══ Section Header ══ */}
      <div className="ab-header">
        <Motion.span className="ab-eyebrow" {...inView(0)}>
          About MS Billings
        </Motion.span>
        <Motion.h2 className="ab-main-heading" {...inView(0.08)}>
          The All-in-One Platform
          <br />
          <span className="ab-main-heading__gold">Built for Restaurants.</span>
        </Motion.h2>
        <Motion.p className="ab-main-sub" {...inView(0.15)}>
          From the first order of the morning to last-call settlements at night,
          MS Billings orchestrates every layer of your operations — so your team
          can focus on what truly matters: delivering extraordinary hospitality.
        </Motion.p>
      </div>

      {/* ══ Stats Row ══ */}
      <div className="ab-stats-row" aria-label="Key statistics">
        {STATS.map((s, i) => (
          <StatCard key={s.label} {...s} index={i} />
        ))}
      </div>

      {/* ══ ROW 1: Image LEFT — Copy RIGHT ══ */}
      <div className="ab-split ab-split--img-left">

        {/* Image */}
        <Motion.div className="ab-visual" {...inView(0.1, 'right')}>
          <div className="ab-visual__glow" aria-hidden="true" />
          <div className="ab-visual__frame">
            <img
              src={VISUAL_1}
              alt="Restaurant POS system on tablet with busy service floor in background"
              loading="lazy"
              decoding="async"
            />
            <div className="ab-visual__frame-shine" aria-hidden="true" />
          </div>
          {/* Floating badge */}
          <Motion.div
            className="ab-badge-float"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            aria-label="10 modules included"
          >
            <Star strokeWidth={1.5} size={13} fill="currentColor" aria-hidden="true" />
            <span>10 Modules Included</span>
          </Motion.div>
        </Motion.div>

        {/* Copy */}
        <div className="ab-copy">
          <Motion.span className="ab-copy__eyebrow" {...inView(0.12)}>
            Designed for Growth
          </Motion.span>
          <Motion.h2 className="ab-copy__heading" {...inView(0.18)}>
            One Platform.
            <span className="ab-copy__heading--accent"> Every Station.</span>
          </Motion.h2>
          <Motion.p className="ab-copy__body" {...inView(0.24)}>
            MS Billings was not built to merely digitalise your billing counter.
            It was built to eliminate the invisible friction that costs restaurants
            time, money, and customers every single day — from inventory discrepancies
            that go unnoticed until month-end to kitchen miscommunications that
            delay tables during a full house.
          </Motion.p>
          <Motion.ul className="ab-bullet-list" {...inView(0.3)} role="list">
            {ROW_1_BULLETS.map((b, i) => (
              <li key={i} className="ab-bullet-list__item">
                <CheckCircle2 size={15} className="ab-bullet-list__icon" aria-hidden="true" />
                <span>{b}</span>
              </li>
            ))}
          </Motion.ul>
          <Motion.a
            href="/login"
            className="ab-cta"
            {...inView(0.36)}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Start your free trial with MS Billings"
          >
            Start Free Trial
            <ArrowRight strokeWidth={1.5} size={15} aria-hidden="true" />
          </Motion.a>
        </div>
      </div>

      {/* ══ ROW 2: Copy LEFT — Image RIGHT ══ */}
      <div className="ab-split ab-split--img-right">

        {/* Copy */}
        <div className="ab-copy">
          <Motion.span className="ab-copy__eyebrow" {...inView(0.08)}>
            Built for Your Team
          </Motion.span>
          <Motion.h2 className="ab-copy__heading" {...inView(0.14)}>
            Simplicity That
            <span className="ab-copy__heading--accent"> Scales.</span>
          </Motion.h2>
          <Motion.p className="ab-copy__body" {...inView(0.2)}>
            Whether you are running a 10-seat heritage café or a multi-outlet
            QSR chain, MS Billings adapts to your pace. Role-based access means
            your cashier sees billing, your manager sees analytics, and you see
            the full picture — from any device, anywhere in the world.
          </Motion.p>
          <Motion.ul className="ab-bullet-list" {...inView(0.26)} role="list">
            {ROW_2_BULLETS.map((b, i) => (
              <li key={i} className="ab-bullet-list__item">
                <CheckCircle2 size={15} className="ab-bullet-list__icon" aria-hidden="true" />
                <span>{b}</span>
              </li>
            ))}
          </Motion.ul>
          <Motion.a
            href="/login"
            className="ab-cta ab-cta--outline"
            {...inView(0.32)}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            aria-label="Login to your MS Billings dashboard"
          >
            See the Dashboard
            <ArrowRight strokeWidth={1.5} size={15} aria-hidden="true" />
          </Motion.a>
        </div>

        {/* Image */}
        <Motion.div className="ab-visual" {...inView(0.1, 'left')}>
          <div className="ab-visual__glow ab-visual__glow--right" aria-hidden="true" />
          <div className="ab-visual__frame">
            <img
              src={VISUAL_2}
              alt="Premium restaurant kitchen with chef plating dishes"
              loading="lazy"
              decoding="async"
            />
            <div className="ab-visual__frame-shine" aria-hidden="true" />
          </div>
          {/* Floating badge */}
          <Motion.div
            className="ab-badge-float ab-badge-float--right"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            aria-label="Cloud ready platform"
          >
            <Cloud size={13} aria-hidden="true" />
            <span>Cloud Ready</span>
          </Motion.div>
        </Motion.div>
      </div>

      {/* ══ Modules Grid ══ */}
      <div className="ab-modules-header">
        <Motion.p className="ab-modules__eyebrow" {...inView(0)}>
          Everything Under One Roof
        </Motion.p>
        <Motion.h2 className="ab-modules__heading" {...inView(0.07)}>
          10 Modules.
          <span className="ab-modules__heading--gold"> Zero Compromises.</span>
        </Motion.h2>
        <Motion.p className="ab-modules__sub" {...inView(0.13)}>
          Every module is purpose-built, beautifully integrated, and works out of the box.
        </Motion.p>
      </div>

      <div className="ab-modules-grid" role="list" aria-label="MS Billings modules">
        {MODULES.map((m, i) => (
          <ModuleCard key={m.title} {...m} index={i} />
        ))}
      </div>

    </div>

    {/* Bottom transition */}
    <div className="ab-bottom-fade" aria-hidden="true" />
  </section>
);

export default About;
