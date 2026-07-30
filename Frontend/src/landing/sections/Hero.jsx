import React, { memo, useRef, useEffect, useState } from 'react';
import { motion as Motion, useReducedMotion, useInView, useAnimation } from 'framer-motion';
import {
  Zap,
  Cloud,
  Package,
  Monitor,
  QrCode,
  ChefHat,
  FileText,
  BarChart3,
} from 'lucide-react';
import './Hero.css';

// ─── Trust Badge Data ───────────────────────────────────────────────────────
const TRUST_BADGES = [
  { icon: Zap,       label: 'Fast Billing'    },
  { icon: Cloud,     label: 'Cloud Ready'     },
  { icon: Package,   label: 'Inventory'       },
  { icon: Monitor,   label: 'POS System'      },
  { icon: BarChart3, label: 'Analytics'       },
  { icon: QrCode,    label: 'QR Ordering'     },
  { icon: ChefHat,   label: 'Kitchen Display' },
  { icon: FileText,  label: 'Smart Reports'   },
];

// ─── Floating Particles ──────────────────────────────────────────────────────
const FLOATERS = [];

// ─── Scroll animation variants (enter + reverse-exit) ────────────────────────
const makeVariants = (delay = 0, yOffset = 30) => ({
  hidden:  { opacity: 0, y: yOffset },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1], delay },
  },
  exit: {
    opacity: 0,
    y: -yOffset * 0.6,
    transition: { duration: 0.4, ease: [0.4, 0, 1, 1] },
  },
});

// ─── Hook: scroll-driven enter + reverse-exit ────────────────────────────────
// Must be called at the TOP of its own component — never inside a parent render.
const useScrollAnim = (delay = 0, yOffset = 30) => {
  const ref      = useRef(null);
  const controls = useAnimation();
  const inView   = useInView(ref, { margin: '-80px 0px -80px 0px', once: false });

  useEffect(() => {
    controls.start(inView ? 'visible' : 'exit');
  }, [inView, controls]);

  return { ref, controls, variants: makeVariants(delay, yOffset) };
};

// ─── Isolated animated wrappers (hook lives at component top-level) ──────────

const AnimEyebrow = memo(() => {
  const { ref, controls, variants } = useScrollAnim(0.22, 24);
  return (
    <Motion.p
      ref={ref}
      className="hero-eyebrow"
      variants={variants}
      initial="hidden"
      animate={controls}
    >
      Restaurant Billing &amp; Management Platform
    </Motion.p>
  );
});

const AnimHeadline = memo(() => {
  const { ref, controls, variants } = useScrollAnim(0.38, 36);
  return (
    <Motion.h1
      ref={ref}
      className="hero-headline"
      variants={variants}
      initial="hidden"
      animate={controls}
    >
      Run Your Restaurant
      <span className="hero-headline__accent"> Smarter.</span>
      <br />
      Grow It
      <span className="hero-headline__gold"> Faster.</span>
    </Motion.h1>
  );
});

const AnimSub = memo(() => {
  const { ref, controls, variants } = useScrollAnim(0.52, 28);
  return (
    <Motion.p
      ref={ref}
      className="hero-sub"
      variants={variants}
      initial="hidden"
      animate={controls}
    >
      MS Billings is the all-in-one billing platform built for
      <strong> fine dining, cloud kitchens, cafés, hotels</strong> and every
      restaurant in between. One tap to bill. Zero friction. Pure growth.
    </Motion.p>
  );
});

const AnimBadges = memo(() => {
  const { ref, controls, variants } = useScrollAnim(0.68, 20);
  return (
    <Motion.div
      ref={ref}
      className="hero-badges"
      role="list"
      aria-label="Key features"
      variants={variants}
      initial="hidden"
      animate={controls}
    >
      {TRUST_BADGES.map((b, i) => (
        <TrustBadge key={b.label} {...b} index={i} />
      ))}
    </Motion.div>
  );
});

// ─── TrustBadge ──────────────────────────────────────────────────────────────
const TrustBadge = memo(({ icon, label, index }) => {
  const Icon = icon;
  const { ref, controls, variants } = useScrollAnim(0.82 + index * 0.07, 18);
  return (
    <Motion.div
      ref={ref}
      className="hero-badge"
      variants={variants}
      initial="hidden"
      animate={controls}
      whileHover={{
        y: -4,
        scale: 1.07,
        boxShadow: '0 6px 20px rgba(184,115,51,0.28)',
        transition: { type: 'spring', stiffness: 340, damping: 18 },
      }}
      // Reverse: spring snaps back to resting state on hover-leave
      whileTap={{ scale: 0.94, y: 0 }}
      aria-label={label}
    >
      <Icon strokeWidth={1.5} size={14} className="hero-badge__icon" aria-hidden="true" />
      <span>{label}</span>
    </Motion.div>
  );
});

// ─── FloatingParticle ────────────────────────────────────────────────────────
const FloatingParticle = memo(({ emoji, size, x, y, delay, dur }) => {
  const prefersReduced = useReducedMotion();
  return (
    <Motion.div
      className="hero-floater"
      style={{ left: x, top: y, fontSize: size }}
      aria-hidden="true"
      animate={prefersReduced ? {} : {
        y:       [0, -18, 0],
        rotate:  [-6, 6, -6],
        opacity: [0.55, 0.85, 0.55],
      }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {emoji}
    </Motion.div>
  );
});

// ─── ScrollIndicator ────────────────────────────────────────────────────────
const ScrollIndicator = memo(() => {
  const { ref, controls, variants } = useScrollAnim(1.8, 16);
  return (
    <Motion.div
      ref={ref}
      className="hero-scroll"
      variants={variants}
      initial="hidden"
      animate={controls}
      aria-label="Scroll down to explore"
    >
      <span className="hero-scroll__text">Scroll to explore</span>
      <div className="hero-scroll__track">
        <Motion.div
          className="hero-scroll__dot"
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </Motion.div>
  );
});

// ─── Hero ────────────────────────────────────────────────────────────────────
const Hero = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      id="home"
      className="hero"
      aria-label="MS Billings — Premium Restaurant Billing Software Hero"
    >
      {/* ── Background video ──────────────────────────────────────── */}
      <video
        className="hero-bg-video"
        src="/src/assets/video/hero_video.webm"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />

      {/* ── Text-readability overlay (fades slightly when scrolled) ── */}
      <div
        className={`hero-text-overlay${scrolled ? ' hero-text-overlay--dim' : ''}`}
        aria-hidden="true"
      />

      {/* ── Floating particles ────────────────────────────────────── */}
      {FLOATERS.map((f, i) => (
        <FloatingParticle key={i} {...f} />
      ))}

      {/* ── Main layout ────────────────────────────────────────────── */}
      <div className="hero-inner landing-container">
        <div className="hero-copy" role="main">
          <AnimEyebrow />
          <AnimHeadline />
          <AnimSub />
          <AnimBadges />
        </div>
      </div>

      {/* ── Scroll indicator ─────────────────────────────────────── */}
      <ScrollIndicator />
    </section>
  );
};

export default Hero;
