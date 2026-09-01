import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import {  UtensilsCrossed, Leaf, Award, Flame, ChefHat } from 'lucide-react';
import { FOOD_SHOWCASE_IMAGES } from '../constants/landingData';
import './FoodShowcase.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.9) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 45 : dir === 'down' ? -45 : 0,
    x: dir === 'left' ? 45 : dir === 'right' ? -45 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-80px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Shared Components ──────────────────────────────────────────── */

const Tag = memo(({ icon, text }) => {
  const Icon = icon;
  return (
    <div className="fs-tag" aria-label={text}>
      <Icon strokeWidth={1.5} size={13} className="fs-tag__icon" aria-hidden="true" />
      <span className="fs-tag__text">{text}</span>
    </div>
  );
});

/* ─── Main Component ─────────────────────────────────────────────── */

const FoodShowcase = () => {
  return (
    <section id="food" className="fs-section" aria-label="Premium Food Showcase">
      
      {/* Background Decor */}
      <div className="fs-bg" aria-hidden="true">
        <div className="fs-bg__gradient fs-bg__gradient--top" />
        <div className="fs-bg__glow fs-bg__glow--left" />
        <div className="fs-bg__glow fs-bg__glow--right" />
        <div className="fs-bg__texture" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. HEADER ══ */}
        <div className="fs-header">
          {/* Removed fs-header__icon-wrap */}
          <Motion.h2 className="fs-heading" {...inView(0.1, 'up')}>
            Every Dish Tells A Story.
            <br />
            <span className="fs-heading__accent">Exceptional Flavours.</span>
          </Motion.h2>
          <Motion.p className="fs-subheading" {...inView(0.2, 'up')}>
            A visual journey through culinary mastery. Hand-crafted ingredients, 
            slow-cooked perfection, and presentation that turns dining into an art form.
          </Motion.p>
        </div>

        {/* ══ 2. LARGE FEATURE DISH ══ */}
        <Motion.div className="fs-feature" {...inView(0.1, 'up')}>
          <div className="fs-image-frame fs-image-frame--feature">
            <img 
              src={FOOD_SHOWCASE_IMAGES.feature} 
              alt="Royal Biryani with saffron and fresh herbs" 
              className="fs-img"
              loading="lazy"
            />
            <div className="fs-overlay fs-overlay--gradient-bottom" />
            
            {/* Hover Glass Effect */}
            <div className="fs-glass-shine" />

            <div className="fs-feature__content">
              <div className="fs-feature__tags">
                <Tag icon={Flame} text="Slow Cooked" />
                <Tag icon={Award} text="Signature Dish" />
              </div>
              <h3 className="fs-feature__title">The Royal Dum Biryani</h3>
              <p className="fs-feature__desc">
                Infused with rare Iranian saffron, marinated for 24 hours, and sealed 
                with dough to capture the essence of heritage spices.
              </p>
            </div>
          </div>
        </Motion.div>

        {/* ══ 3. TWO SUPPORTING DISHES ══ */}
        <div className="fs-grid-2">
          
          <Motion.div className="fs-card fs-card--support" {...inView(0.1, 'right')}>
            <div className="fs-image-frame">
              <img 
                src={FOOD_SHOWCASE_IMAGES.support1} 
                alt="Premium Wagyu Steak" 
                className="fs-img"
                loading="lazy"
              />
              <div className="fs-overlay fs-overlay--vignette" />
              <div className="fs-glass-shine" />
            </div>
            <div className="fs-card__meta">
              <Tag icon={ChefHat} text="Chef's Selection" />
              <h4 className="fs-card__title">Aged Wagyu Reserve</h4>
              <p className="fs-card__desc">Charred to perfection, rested in garlic herb butter.</p>
            </div>
          </Motion.div>

          <Motion.div className="fs-card fs-card--support" {...inView(0.2, 'left')}>
            <div className="fs-image-frame">
              <img 
                src={FOOD_SHOWCASE_IMAGES.support2} 
                alt="Handmade Truffle Pasta" 
                className="fs-img"
                loading="lazy"
              />
              <div className="fs-overlay fs-overlay--vignette" />
              <div className="fs-glass-shine" />
            </div>
            <div className="fs-card__meta">
              <Tag icon={UtensilsCrossed} text="Hand Crafted" />
              <h4 className="fs-card__title">Artisanal Truffle Pasta</h4>
              <p className="fs-card__desc">Hand-rolled ribbons laced with black winter truffle shavings.</p>
            </div>
          </Motion.div>

        </div>
      </div>

      {/* ══ 4. FULL WIDTH CINEMATIC ══ */}
      <Motion.div className="fs-cinematic" {...inView(0.1, 'up')}>
        <div className="fs-cinematic__frame">
          <img 
            src={FOOD_SHOWCASE_IMAGES.cinematic} 
            alt="Chef delicately plating a gourmet dish" 
            className="fs-cinematic__img"
            loading="lazy"
          />
          <div className="fs-cinematic__overlay" />
          
          <div className="fs-cinematic__content">
            <Motion.p className="fs-cinematic__eyebrow" {...inView(0.3, 'up')}>
              The Art of Plating
            </Motion.p>
            <Motion.h3 className="fs-cinematic__title" {...inView(0.4, 'up')}>
              Precision in Every Detail
            </Motion.h3>
          </div>
        </div>
      </Motion.div>

      <div className="landing-container">
        
        {/* ══ 5. ALTERNATING SPLIT LAYOUT ══ */}
        <div className="fs-split-section">
          
          {/* Split 1: Image Left, Text Right */}
          <div className="fs-split fs-split--left">
            <Motion.div className="fs-split__img-wrap" {...inView(0.1, 'right')}>
              <div className="fs-image-frame fs-image-frame--split">
                <img src={FOOD_SHOWCASE_IMAGES.split1} alt="Gourmet Truffle Burger" className="fs-img" loading="lazy" />
                <div className="fs-glass-shine" />
              </div>
            </Motion.div>
            
            <div className="fs-split__content">
              <Motion.div {...inView(0.2, 'up')}>
                <Tag icon={Award} text="Premium Ingredients" />
                <h3 className="fs-split__title">The Truffle Brioche Burger</h3>
                <p className="fs-split__desc">
                  A symphony of textures. Double-smashed wagyu patties, melted aged cheddar, 
                  and house-made truffle aioli, all resting within a golden toasted brioche bun.
                </p>
              </Motion.div>
            </div>
          </div>

          {/* Split 2: Text Left, Image Right */}
          <div className="fs-split fs-split--right">
            <div className="fs-split__content">
              <Motion.div {...inView(0.2, 'up')}>
                <Tag icon={Flame} text="Wood-Fired" />
                <h3 className="fs-split__title">Rustic Neapolitan Pizza</h3>
                <p className="fs-split__desc">
                  Blistered in a 500-degree stone oven for exactly 90 seconds. 
                  San Marzano tomatoes, fresh buffalo mozzarella, and hand-torn basil leaves.
                </p>
              </Motion.div>
            </div>
            
            <Motion.div className="fs-split__img-wrap" {...inView(0.1, 'left')}>
              <div className="fs-image-frame fs-image-frame--split">
                <img src={FOOD_SHOWCASE_IMAGES.split2} alt="Wood-fired Neapolitan Pizza" className="fs-img" loading="lazy" />
                <div className="fs-glass-shine" />
              </div>
            </Motion.div>
          </div>

        </div>

        {/* ══ 6. ELEGANT MASONRY / FLOATING ══ */}
        <div className="fs-masonry-header">
          <Motion.h3 className="fs-masonry-heading" {...inView(0.1, 'up')}>
            A Complete Experience
          </Motion.h3>
        </div>

        <div className="fs-masonry">
          
          <Motion.div className="fs-masonry__item fs-masonry__item--large" {...inView(0.1, 'up')}>
            <div className="fs-image-frame">
              <img src={FOOD_SHOWCASE_IMAGES.masonry1} alt="Fresh Seafood Platter" className="fs-img" loading="lazy" />
              <div className="fs-overlay fs-overlay--hover-only" />
              <div className="fs-masonry__meta">
                <Tag icon={Leaf} text="Fresh Catch" />
                <h4>Coastal Seafood Platter</h4>
              </div>
            </div>
          </Motion.div>

          <Motion.div className="fs-masonry__item fs-masonry__item--tall" {...inView(0.2, 'up')}>
            <div className="fs-image-frame">
              <img src={FOOD_SHOWCASE_IMAGES.masonry2} alt="Luxury Chocolate Dessert" className="fs-img" loading="lazy" />
              <div className="fs-overlay fs-overlay--hover-only" />
              <div className="fs-masonry__meta">
                <Tag icon={Award} text="Patisserie" />
                <h4>Velvet Chocolate Dome</h4>
              </div>
            </div>
          </Motion.div>

          <Motion.div className="fs-masonry__item fs-masonry__item--wide" {...inView(0.3, 'up')}>
            <div className="fs-image-frame">
              <img src={FOOD_SHOWCASE_IMAGES.masonry3} alt="Artisanal Latte Art" className="fs-img" loading="lazy" />
              <div className="fs-overlay fs-overlay--hover-only" />
              <div className="fs-masonry__meta">
                <Tag icon={UtensilsCrossed} text="Barista Crafted" />
                <h4>Ethiopian Single Origin</h4>
              </div>
            </div>
          </Motion.div>

        </div>

      </div>
    </section>
  );
};

export default memo(FoodShowcase);
