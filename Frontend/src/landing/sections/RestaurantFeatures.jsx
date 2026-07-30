import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { 
  Users, 
  BookOpen, 
  ChefHat, 
  CreditCard, 
  TrendingUp,
  ArrowDown
} from 'lucide-react';
import './RestaurantFeatures.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.9) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 50 : dir === 'down' ? -50 : 0,
    x: dir === 'left' ? 50 : dir === 'right' ? -50 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-80px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Data ───────────────────────────────────────────────────────── */

const WORKFLOW_STEPS = [
  {
    id: '01',
    icon: Users,
    title: 'Customer Arrival & Allocation',
    desc: 'Instantly allocate tables using the visual floor plan. Greet returning customers by name through our integrated loyalty insights.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=85&auto=format&fit=crop'
  },
  {
    id: '02',
    icon: BookOpen,
    title: 'Smart Order Creation',
    desc: 'Captains take orders via tablet or customers use QR menus. Instant syncing ensures zero delays between the table and the kitchen.',
    image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=900&q=85&auto=format&fit=crop'
  },
  {
    id: '03',
    icon: ChefHat,
    title: 'Kitchen Orchestration',
    desc: 'Orders appear instantly on the Kitchen Display System (KDS). Prep times are tracked, and dishes are fired precisely when needed.',
    image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=900&q=85&auto=format&fit=crop'
  },
  {
    id: '04',
    icon: CreditCard,
    title: 'Seamless Settlement',
    desc: 'Split bills, apply discounts, and accept multi-mode payments in seconds. Digital GST-ready receipts are generated instantly.',
    image: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&q=85&auto=format&fit=crop'
  },
  {
    id: '05',
    icon: TrendingUp,
    title: 'Automated Insights',
    desc: 'Inventory depletes automatically. The day ends with comprehensive performance reports, identifying your most profitable dishes.',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=900&q=85&auto=format&fit=crop'
  }
];

/* ─── Components ─────────────────────────────────────────────────── */

const WorkflowCard = React.memo(({ step, index }) => {
  const Icon = step.icon;
  const isEven = index % 2 === 0;

  return (
    <div className={`rw-card-wrapper ${isEven ? 'rw-card-wrapper--left' : 'rw-card-wrapper--right'}`}>
      
      {/* Center Line Node */}
      <div className="rw-timeline-node" aria-hidden="true">
        <Motion.div 
          className="rw-timeline-node__inner"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: false, margin: '-100px' }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
        >
          <div className="rw-timeline-node__core" />
        </Motion.div>
      </div>

      <Motion.div 
        className="rw-card"
        {...inView(0.1, isEven ? 'right' : 'left')}
        role="article"
      >
        <div className="rw-card__visual">
          <img src={step.image} alt={step.title} className="rw-card__img" loading="lazy" />
          <div className="rw-glass-reflection" />
        </div>
        
        <div className="rw-card__content">
          <div className="rw-card__header">
            <span className="rw-card__number">{step.id}</span>
            <div className="rw-card__icon-wrap">
              <Icon strokeWidth={1.5} size={20} className="rw-card__icon" aria-hidden="true" />
            </div>
          </div>
          <h3 className="rw-card__title">{step.title}</h3>
          <p className="rw-card__desc">{step.desc}</p>
        </div>
      </Motion.div>
    </div>
  );
});

/* ─── Main Section ───────────────────────────────────────────────── */

const RestaurantFeatures = () => {
  return (
    <section id="features" className="rw-section" aria-label="Restaurant Workflow Experience">
      
      {/* Background Decor */}
      <div className="rw-bg" aria-hidden="true">
        <div className="rw-bg__gradient rw-bg__gradient--top" />
        <div className="rw-bg__blob rw-bg__blob--1" />
        <div className="rw-bg__blob rw-bg__blob--2" />
        <div className="rw-bg__texture" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. HEADER ══ */}
        <div className="rw-header">
          <Motion.span className="rw-eyebrow" {...inView(0, 'up')}>
            The Complete Journey
          </Motion.span>
          <Motion.h2 className="rw-heading" {...inView(0.1, 'up')}>
            Every Order. Every Table.
            <br />
            <span className="rw-heading__accent">Every Detail.</span>
          </Motion.h2>
          <Motion.p className="rw-subheading" {...inView(0.2, 'up')}>
            Experience the harmony of a perfectly connected restaurant. From the moment 
            a guest arrives to the final settlement, MS Billings orchestrates every step 
            in one seamless, elegant flow.
          </Motion.p>
          
          <Motion.div className="rw-header-indicator" {...inView(0.3, 'up')}>
            <ArrowDown strokeWidth={1.5} size={20} className="rw-header-indicator__icon" />
          </Motion.div>
        </div>

        {/* ══ 2. WORKFLOW TIMELINE ══ */}
        <div className="rw-timeline-container">
          
          {/* Animated Center Line */}
          <div className="rw-timeline-path">
            <Motion.div 
              className="rw-timeline-path__progress"
              initial={{ height: '0%' }}
              whileInView={{ height: '100%' }}
              viewport={{ once: false, margin: '-20%' }}
              transition={{ duration: 2.5, ease: 'easeInOut' }}
            />
          </div>

          <div className="rw-timeline">
            {WORKFLOW_STEPS.map((step, index) => (
              <WorkflowCard key={step.id} step={step} index={index} />
            ))}
          </div>

        </div>

      </div>
      
      <div className="rw-bg__gradient rw-bg__gradient--bottom" aria-hidden="true" />
    </section>
  );
};

export default memo(RestaurantFeatures);
