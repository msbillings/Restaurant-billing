import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { 
  MonitorSmartphone, 
  ChefHat, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Receipt,
  PackageSearch,
  CloudLightning,
  QrCode,
  LineChart
} from 'lucide-react';
import './MSBillingsFeatures.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.8) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 40 : dir === 'down' ? -40 : 0,
    x: dir === 'left' ? 40 : dir === 'right' ? -40 : 0,
  },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Mockup Assets ──────────────────────────────────────────────── */

const MOCKUPS = {
  pos:       'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1000&q=85&auto=format&fit=crop',
  kitchen:   'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&q=85&auto=format&fit=crop',
  inventory: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=85&auto=format&fit=crop',
  analytics: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=85&auto=format&fit=crop',
  cloud:     'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=900&q=85&auto=format&fit=crop',
  mobile:    'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=900&q=85&auto=format&fit=crop'
};

/* ─── Components ─────────────────────────────────────────────────── */

const FeaturePill = memo(({ icon, text }) => {
  const Icon = icon;
  return (
    <div className="msbf-pill">
      <Icon strokeWidth={1.5} size={14} className="msbf-pill__icon" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
});

const MiniFeature = memo(({ icon, title, desc }) => {
  const Icon = icon;
  return (
    <div className="msbf-mini">
      <div className="msbf-mini__icon-wrap">
        <Icon strokeWidth={1.5} size={18} aria-hidden="true" />
      </div>
      <div>
        <h5 className="msbf-mini__title">{title}</h5>
        <p className="msbf-mini__desc">{desc}</p>
      </div>
    </div>
  );
});

/* ─── Main Section ───────────────────────────────────────────────── */

const MSBillingsFeatures = () => {
  return (
    <section id="ms-billings" className="msbf-section" aria-label="MS Billings Features">
      
      {/* Background Decor */}
      <div className="msbf-bg" aria-hidden="true">
        <div className="msbf-bg__glow msbf-bg__glow--1" />
        <div className="msbf-bg__glow msbf-bg__glow--2" />
        <div className="msbf-bg__glow msbf-bg__glow--3" />
        <div className="msbf-bg__grid" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. HEADER ══ */}
        <div className="msbf-header">
          <Motion.span className="msbf-eyebrow" {...inView(0, 'up')}>
            The Complete Ecosystem
          </Motion.span>
          <Motion.h2 className="msbf-heading" {...inView(0.1, 'up')}>
            Run Your Entire Restaurant
            <br />
            <span className="msbf-heading__accent">Beautifully.</span>
          </Motion.h2>
          <Motion.p className="msbf-subheading" {...inView(0.2, 'up')}>
            MS Billings seamlessly unites the front-of-house, kitchen, and back-office 
            into one beautifully designed, lightning-fast platform. 
          </Motion.p>
        </div>

        {/* ══ 2. BENTO GRID ══ */}
        <div className="msbf-bento">
          
          {/* Large Feature: POS & Billing */}
          <Motion.div className="msbf-card msbf-card--large" {...inView(0.1, 'up')}>
            <div className="msbf-card__content">
              <div className="msbf-card__meta">
                <FeaturePill icon={MonitorSmartphone} text="Point of Sale" />
                <FeaturePill icon={Receipt} text="Smart Billing" />
              </div>
              <h3 className="msbf-card__title">Lightning Fast POS</h3>
              <p className="msbf-card__desc">
                Engineered for speed. Process orders, split bills, apply discounts, 
                and generate GST-compliant digital receipts in under 3 seconds.
              </p>
              <div className="msbf-card__visual msbf-card__visual--pos">
                <img src={MOCKUPS.pos} alt="Elegant POS Interface" loading="lazy" />
                <div className="msbf-glass-reflection" />
              </div>
            </div>
          </Motion.div>

          {/* Small Feature: Kitchen Order Management */}
          <Motion.div className="msbf-card msbf-card--small" {...inView(0.2, 'up')}>
            <div className="msbf-card__content">
              <FeaturePill icon={ChefHat} text="Kitchen Display System" />
              <h3 className="msbf-card__title">Zero Lost Orders</h3>
              <p className="msbf-card__desc">
                Digital KDS screens that route orders directly to stations, 
                eliminating paper tickets and miscommunications.
              </p>
              <div className="msbf-card__visual msbf-card__visual--sm">
                <img src={MOCKUPS.kitchen} alt="Kitchen Tablet Interface" loading="lazy" />
              </div>
            </div>
          </Motion.div>

          {/* Small Feature: Inventory */}
          <Motion.div className="msbf-card msbf-card--small" {...inView(0.3, 'up')}>
            <div className="msbf-card__content">
              <FeaturePill icon={PackageSearch} text="Inventory Management" />
              <h3 className="msbf-card__title">Smart Stocking</h3>
              <p className="msbf-card__desc">
                Real-time ingredient tracking, low-stock alerts, and recipe-level 
                depletion to minimize costly wastage.
              </p>
              <div className="msbf-card__visual msbf-card__visual--sm">
                <img src={MOCKUPS.inventory} alt="Inventory Tracking Interface" loading="lazy" />
              </div>
            </div>
          </Motion.div>

          {/* Wide Feature: Analytics */}
          <Motion.div className="msbf-card msbf-card--wide" {...inView(0.2, 'up')}>
            <div className="msbf-card__content msbf-card__content--split">
              <div className="msbf-card__text">
                <div className="msbf-card__meta">
                  <FeaturePill icon={BarChart3} text="Reports & Analytics" />
                  <FeaturePill icon={LineChart} text="Business Insights" />
                </div>
                <h3 className="msbf-card__title">360° Business Visibility</h3>
                <p className="msbf-card__desc">
                  Stop guessing. View live sales data, track peak hours, monitor staff 
                  performance, and analyze expenses across multiple outlets from a single pane of glass.
                </p>
                <div className="msbf-card__mini-grid">
                  <MiniFeature icon={BarChart3} title="Tax Management" desc="Automated GST reports." />
                  <MiniFeature icon={LineChart} title="Expense Tracking" desc="Monitor daily payouts." />
                </div>
              </div>
              <div className="msbf-card__visual msbf-card__visual--wide">
                <img src={MOCKUPS.analytics} alt="Analytics Dashboard" loading="lazy" />
                <div className="msbf-glass-reflection" />
              </div>
            </div>
          </Motion.div>

        </div>

        {/* ══ 3. CONNECTING LINE ══ */}
        <div className="msbf-connector">
          <Motion.div 
            className="msbf-connector__line" 
            initial={{ height: 0 }}
            whileInView={{ height: '100px' }}
            viewport={{ once: false }}
            transition={{ duration: 1, ease: 'easeOut' }}
            aria-hidden="true"
          />
          <div className="msbf-connector__dot" aria-hidden="true" />
        </div>

        {/* ══ 4. ALTERNATING LAYOUT ══ */}
        <div className="msbf-alt-section">

          {/* Left Right Block 1 */}
          <div className="msbf-alt-block">
            <Motion.div className="msbf-alt-block__visual" {...inView(0.1, 'right')}>
              <div className="msbf-alt-image-frame">
                <img src={MOCKUPS.mobile} alt="QR Menu & Customer Loyalty" loading="lazy" />
                <div className="msbf-alt-image-glow" />
              </div>
            </Motion.div>
            
            <div className="msbf-alt-block__content">
              <Motion.div {...inView(0.2, 'up')}>
                <FeaturePill icon={Users} text="Customer Management" />
                <h3 className="msbf-alt-title">Elevate the Guest Experience</h3>
                <p className="msbf-alt-desc">
                  Recognize your regulars instantly. Track preferences, manage loyalty 
                  points, and offer seamless QR-based digital menus and ordering directly from their tables.
                </p>
                <div className="msbf-alt-features">
                  <MiniFeature icon={QrCode} title="QR Menu" desc="Touchless, live updates." />
                  <MiniFeature icon={Users} title="Table Management" desc="Visual floor plan control." />
                </div>
              </Motion.div>
            </div>
          </div>

          {/* Left Right Block 2 (Reversed) */}
          <div className="msbf-alt-block msbf-alt-block--reverse">
            <div className="msbf-alt-block__content">
              <Motion.div {...inView(0.2, 'up')}>
                <FeaturePill icon={ShieldCheck} text="Enterprise Security" />
                <h3 className="msbf-alt-title">Bank-Grade Cloud Infrastructure</h3>
                <p className="msbf-alt-desc">
                  Your restaurant's data is your most valuable asset. MS Billings 
                  ensures total security with end-to-end encryption, automated backups, 
                  and strict role-based access control.
                </p>
                <div className="msbf-alt-features">
                  <MiniFeature icon={CloudLightning} title="Cloud Ready" desc="Access from anywhere." />
                  <MiniFeature icon={ShieldCheck} title="Role Access" desc="Staff vs Admin permissions." />
                </div>
              </Motion.div>
            </div>
            
            <Motion.div className="msbf-alt-block__visual" {...inView(0.1, 'left')}>
              <div className="msbf-alt-image-frame">
                <img src={MOCKUPS.cloud} alt="Cloud Infrastructure Security" loading="lazy" />
                <div className="msbf-alt-image-glow msbf-alt-image-glow--right" />
              </div>
            </Motion.div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default memo(MSBillingsFeatures);
