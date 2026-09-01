import { getApiUrl } from '../../config.js';
import React, { memo, useEffect, useState, useRef } from 'react';
import { motion as Motion, useInView } from 'framer-motion';
import { Star, Quote, TrendingUp, Store, CloudLightning, BadgeDollarSign } from 'lucide-react';
import axios from 'axios';
import { STATS as DEFAULT_STATS, REVIEWS } from '../constants/landingData';
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

/* ─── Number Formatter ───────────────────────────────────────────── */

const formatStat = (num, isCurrency = false) => {
  const n = Number(num) || 0;
  if (isCurrency) {
    if (n >= 10000000) {
      return { value: parseFloat((n / 10000000).toFixed(1)), prefix: '₹', suffix: 'Cr+' };
    }
    if (n >= 100000) {
      return { value: parseFloat((n / 100000).toFixed(1)), prefix: '₹', suffix: 'L+' };
    }
    if (n >= 1000) {
      return { value: parseFloat((n / 1000).toFixed(1)), prefix: '₹', suffix: 'k+' };
    }
    return { value: Math.round(n), prefix: '₹', suffix: '+' };
  }

  if (n >= 1000000) {
    return { value: parseFloat((n / 1000000).toFixed(1)), prefix: '', suffix: 'M+' };
  }
  if (n >= 1000) {
    return { value: parseFloat((n / 1000).toFixed(1)), prefix: '', suffix: 'k+' };
  }
  return { value: n, prefix: '', suffix: n > 0 ? '+' : '' };
};

/* ─── Animated Counter ───────────────────────────────────────────── */

const AnimatedCounter = ({ value, suffix = '', prefix = '' }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const isDecimal = String(value).includes('.');

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const duration = 1200; // ms
    const steps = 30;
    const stepTime = duration / steps;
    const increment = target / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, isDecimal]);

  return (
    <span className="t-stat__number">
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

const INITIAL_STATS = [
  { id: 1, value: 7.8, prefix: '', suffix: 'k+', label: 'Orders Processed', icon: TrendingUp },
  { id: 2, value: 9, prefix: '', suffix: '+', label: 'Partner Restaurants', icon: Store },
  { id: 3, value: 64.8, prefix: '₹', suffix: 'L+', label: 'Revenue Managed', icon: BadgeDollarSign },
  { id: 4, value: 99.9, prefix: '', suffix: '%', label: 'Cloud Uptime', icon: CloudLightning },
];

const Testimonials = () => {
  const [statsData, setStatsData] = useState(INITIAL_STATS);

  useEffect(() => {
    let isMounted = true;
    const fetchPlatformStats = async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/public/platform-stats`, { timeout: 6000 });
        if (res.data?.success && res.data?.stats && isMounted) {
          const { ordersProcessed, partnerRestaurants, revenueManaged, uptimePercentage } = res.data.stats;
          
          const ordersFmt = formatStat(ordersProcessed);
          const partnersFmt = formatStat(partnerRestaurants);
          const revenueFmt = formatStat(revenueManaged, true);

          setStatsData([
            {
              id: 1,
              value: ordersFmt.value,
              prefix: ordersFmt.prefix,
              suffix: ordersFmt.suffix,
              label: 'Orders Processed',
              icon: TrendingUp
            },
            {
              id: 2,
              value: partnersFmt.value,
              prefix: partnersFmt.prefix,
              suffix: partnersFmt.suffix,
              label: 'Partner Restaurants',
              icon: Store
            },
            {
              id: 3,
              value: revenueFmt.value,
              prefix: revenueFmt.prefix,
              suffix: revenueFmt.suffix,
              label: 'Revenue Managed',
              icon: BadgeDollarSign
            },
            {
              id: 4,
              value: uptimePercentage || 99.9,
              prefix: '',
              suffix: '%',
              label: 'Cloud Uptime',
              icon: CloudLightning
            }
          ]);
        }
      } catch (err) {
        console.warn('[Landing Stats] Using default statistics:', err.message);
      }
    };

    fetchPlatformStats();
    return () => { isMounted = false; };
  }, []);

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
            {statsData.map((stat, index) => (
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
