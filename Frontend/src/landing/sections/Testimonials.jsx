import React, { memo, useEffect, useState } from 'react';
import { motion as Motion, useInView } from 'framer-motion';
import { Star, Quote, TrendingUp, Store, CloudLightning, BadgeDollarSign } from 'lucide-react';
import { useRef } from 'react';
import { STATS, REVIEWS } from '../constants/landingData';
import './Testimonials.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.9) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 40 : dir === 'down' ? -40 : 0,
    x: dir === 'left' ? 40 : dir === 'right' ? -40 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Animated Counter ───────────────────────────────────────────── */

const AnimatedCounter = ({ value, suffix = '', prefix = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const duration = 2000; // ms
      const incrementTime = 20;
      const step = end / (duration / incrementTime);
      
      const timer = setInterval(() => {
        start += step;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, incrementTime);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  // For values like 99.9, handle differently (mocking simplified for integers here, hardcode the decimal if needed)
  const displayValue = value === 99 ? '99.9' : count;

  return (
    <span ref={ref} className="t-stat__number">
      {prefix}{displayValue}{suffix}
    </span>
  );
};

/* ─── Components ─────────────────────────────────────────────────── */

const StatCard = memo(({ stat, index }) => {
  const Icon = stat.icon;
  return (
    <Motion.div className="t-stat" {...inView(0.1 + index * 0.1, 'up')}>
      <div className="t-stat__icon-wrap">
        <Icon strokeWidth={1.5} size={22} className="t-stat__icon" />
      </div>
      <div className="t-stat__content">
        <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
        <span className="t-stat__label">{stat.label}</span>
      </div>
    </Motion.div>
  );
});

const ReviewCard = memo(({ review, delay }) => {
  return (
    <Motion.div 
      className={`t-review ${review.isFeatured ? 't-review--featured' : 't-review--standard'}`} 
      {...inView(delay, 'up')}
    >
      <div className="t-review__glass-shine" />
      
      <div className="t-review__header">
        <div className="t-review__stars">
          {[...Array(5)].map((_, i) => (
            <Star strokeWidth={1.5} key={i} size={16} className="t-review__star" fill="currentColor" />
          ))}
        </div>
        <Quote strokeWidth={1.5} size={28} className="t-review__quote-icon" />
      </div>

      <p className="t-review__text">"{review.text}"</p>

      <div className="t-review__author">
        <img src={review.avatar} alt={review.name} className="t-review__avatar" loading="lazy" />
        <div className="t-review__meta">
          <span className="t-review__name">{review.name}</span>
          <span className="t-review__role">{review.role} — {review.restaurant}</span>
        </div>
      </div>
    </Motion.div>
  );
});

/* ─── Main Section ───────────────────────────────────────────────── */

const Testimonials = () => {
  return (
    <section id="reviews" className="t-section" aria-label="Statistics and Testimonials">
      
      {/* Background Decor */}
      <div className="t-bg" aria-hidden="true">
        <div className="t-bg__gradient t-bg__gradient--top" />
        <div className="t-bg__glow t-bg__glow--1" />
        <div className="t-bg__glow t-bg__glow--2" />
        <div className="t-bg__grid" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. STATISTICS ══ */}
        <div className="t-stats-container">
          <Motion.div className="t-stats-header" {...inView(0, 'left')}>
            <h3 className="t-stats-heading">Powering Modern Hospitality</h3>
            <p className="t-stats-subheading">Numbers that define reliability and scale.</p>
          </Motion.div>
          
          <div className="t-stats-grid">
            {STATS.map((stat, index) => (
              <StatCard key={stat.id} stat={stat} index={index} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="t-divider" aria-hidden="true">
          <div className="t-divider__line" />
          <Star strokeWidth={1.5} size={14} className="t-divider__icon" />
          <div className="t-divider__line" />
        </div>

        {/* ══ 2. TESTIMONIALS HEADER ══ */}
        <div className="t-header">
          <Motion.span className="t-eyebrow" {...inView(0, 'up')}>
            Wall of Love
          </Motion.span>
          <Motion.h2 className="t-heading" {...inView(0.1, 'up')}>
            Don't Just Take 
            <br />
            <span className="t-heading__accent">Our Word For It.</span>
          </Motion.h2>
        </div>

        {/* ══ 3. REVIEWS LAYOUT ══ */}
        <div className="t-reviews-grid">
          {/* Featured Review (Spans full width or large area) */}
          <ReviewCard review={REVIEWS[0]} delay={0.2} />
          
          {/* Secondary Reviews */}
          <div className="t-reviews-secondary">
            <ReviewCard review={REVIEWS[1]} delay={0.3} />
            <ReviewCard review={REVIEWS[2]} delay={0.4} />
          </div>
        </div>

      </div>
    </section>
  );
};

export default memo(Testimonials);
