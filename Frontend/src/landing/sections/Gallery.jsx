import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Star, Building2, Utensils, Coffee, Crown } from 'lucide-react';
import { GALLERY_IMAGES, TRUST_LOGOS } from '../constants/landingData';
import './Gallery.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.9) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 50 : dir === 'down' ? -50 : 0,
    x: dir === 'left' ? 40 : dir === 'right' ? -40 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Components ─────────────────────────────────────────────────── */

const GalleryItem = memo(({ src, alt, className, delay = 0, dir = 'up' }) => (
  <Motion.div className={`pg-item ${className}`} {...inView(delay, dir)}>
    <div className="pg-item__frame">
      <img src={src} alt={alt} className="pg-item__img" loading="lazy" />
      <div className="pg-item__overlay" />
      <div className="pg-glass-shine" />
    </div>
  </Motion.div>
));

const TrustBadge = memo(({ logo, index }) => {
  const Icon = logo.icon;
  return (
    <Motion.div className="pt-badge" {...inView(0.1 + index * 0.1, 'up')}>
      <Icon strokeWidth={1.5} size={24} className="pt-badge__icon" aria-hidden="true" />
      <span className="pt-badge__name">{logo.name}</span>
    </Motion.div>
  );
});

/* ─── Main Section ───────────────────────────────────────────────── */

const Gallery = () => {
  return (
    <section id="gallery" className="pg-section" aria-label="Premium Gallery and Trust">
      
      {/* Background Decor */}
      <div className="pg-bg" aria-hidden="true">
        <div className="pg-bg__glow pg-bg__glow--1" />
        <div className="pg-bg__glow pg-bg__glow--2" />
        <div className="pg-bg__texture" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. GALLERY HEADER ══ */}
        <div className="pg-header">
          <Motion.span className="pg-eyebrow" {...inView(0, 'up')}>
            The Atmosphere
          </Motion.span>
          <Motion.h2 className="pg-heading" {...inView(0.1, 'up')}>
            Crafting Unforgettable
            <br />
            <span className="pg-heading__accent">Dining Experiences.</span>
          </Motion.h2>
          <Motion.p className="pg-subheading" {...inView(0.2, 'up')}>
            A visual journey through the spaces, faces, and moments that make the culinary 
            world extraordinary. Built for restaurants that care about every detail.
          </Motion.p>
        </div>

        {/* ══ 2. ASYMMETRICAL GALLERY ══ */}
        <div className="pg-grid">
          <GalleryItem 
            src={GALLERY_IMAGES.main} 
            alt="Fine dining restaurant interior" 
            className="pg-item--hero" 
            delay={0.1} 
          />
          <GalleryItem 
            src={GALLERY_IMAGES.tall1} 
            alt="Chef preparing a gourmet dish" 
            className="pg-item--tall" 
            delay={0.2} 
            dir="left"
          />
          <GalleryItem 
            src={GALLERY_IMAGES.tall2} 
            alt="Elegant table setup with wine glasses" 
            className="pg-item--tall2" 
            delay={0.3} 
            dir="right"
          />
          <GalleryItem 
            src={GALLERY_IMAGES.square1} 
            alt="Barista pouring artisanal coffee" 
            className="pg-item--square" 
            delay={0.2} 
          />
          <GalleryItem 
            src={GALLERY_IMAGES.wide} 
            alt="Cozy ambient restaurant seating" 
            className="pg-item--wide" 
            delay={0.3} 
          />
          <GalleryItem 
            src={GALLERY_IMAGES.square2} 
            alt="Premium dessert plating" 
            className="pg-item--square2" 
            delay={0.4} 
          />
        </div>

        {/* ══ 3. TRUST SECTION ══ */}
        <div className="pt-section">
          <Motion.h3 className="pt-heading" {...inView(0.1, 'up')}>
            Trusted By The World's Finest Restaurants
          </Motion.h3>
          <Motion.p className="pt-subheading" {...inView(0.2, 'up')}>
            Join thousands of premier dining establishments that rely on MS Billings.
          </Motion.p>

          <div className="pt-logos">
            {TRUST_LOGOS.map((logo, index) => (
              <TrustBadge key={logo.name} logo={logo} index={index} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default memo(Gallery);
