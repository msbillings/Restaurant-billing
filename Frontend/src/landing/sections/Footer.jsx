import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { 
  Instagram, 
  Twitter, 
  Linkedin, 
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import './Footer.css';

/* ─── Components ─────────────────────────────────────────────────── */

const SocialIcon = memo(({ icon, label, url = "#" }) => {
  const Icon = icon;
  return (
    <a href={url} className="f-social-link" aria-label={label} target="_blank" rel="noopener noreferrer">
      <Icon strokeWidth={1.5} size={18} className="f-social-icon" />
    </a>
  );
});

/* ─── Main Section ───────────────────────────────────────────────── */

const Footer = () => {
  

  return (
    <footer id="contact" className="f-section" aria-label="Footer">
      
      {/* Background Decor */}
      <div className="f-bg" aria-hidden="true">
        <div className="f-bg__glow" />
        <div className="f-bg__texture" />
      </div>

      <div className="landing-container">
        
        {/* ══ 1. MAIN FOOTER CONTENT ══ */}
        <div className="f-grid">
          
          {/* Column 1: Brand */}
          <div className="f-col f-col--brand">
            <h2 className="f-brand">MS Billings<span className="f-brand__dot">.</span></h2>
            <p className="f-desc">
              The premium operating system for modern restaurants. Designed to blend 
              seamlessly into your workflow, elevating both efficiency and guest experience.
            </p>
            <div className="f-socials">
              <SocialIcon icon={Instagram} label="Instagram" url="https://www.instagram.com/msbillling?igsh=cmZoOTRobGM2ZzJ6" />
              <SocialIcon icon={Twitter} label="Twitter" />
              <SocialIcon icon={Linkedin} label="LinkedIn" />
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="f-col">
            <h4 className="f-heading">Product</h4>
            <ul className="f-links">
              <li><a href="#ms-billings" className="f-link">Features</a></li>
              <li><a href="#features" className="f-link">Workflow</a></li>
              <li><a href="#gallery" className="f-link">Gallery</a></li>
              <li><a href="#reviews" className="f-link">Reviews</a></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="f-col">
            <h4 className="f-heading">Resources</h4>
            <ul className="f-links">
              <li><a href="#cta" className="f-link">Help Center</a></li>
              <li><a href="#reviews" className="f-link">Blog</a></li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div className="f-col">
            <h4 className="f-heading">Contact</h4>
            <ul className="f-contact-list">
              <li className="f-contact-item">
                <Mail strokeWidth={1.5} size={16} className="f-contact-icon" />
                <span>msbillling@gmail.com</span>
              </li>
              <li className="f-contact-item">
                <Phone strokeWidth={1.5} size={16} className="f-contact-icon" />
                <span>+91 9032223352</span>
              </li>
              <li className="f-contact-item">
                <Phone strokeWidth={1.5} size={16} className="f-contact-icon" />
                <span>+91 9492321619</span>
              </li>
              <li className="f-contact-item">
                <a href="https://www.google.com/maps/place/MS+Tech+Hive/@14.4670821,78.8377988,17z/data=!3m1!4b1!4m6!3m5!1s0x3bb373002cfcc90f:0x75c59bc3329a8a59!8m2!3d14.4670821!4d78.8377988!16s%2Fg%2F11xp16y38_?entry=ttu&g_ep=EgoyMDI2MDcyNy4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noopener noreferrer" className="f-contact-link">
                  <MapPin strokeWidth={1.5} size={16} className="f-contact-icon" />
                  <span>near Gurukul Vidyapeeth, CMR Palli, Chinna Chauku, Andhra Pradesh 516001</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ══ 2. FOOTER BOTTOM ══ */}
        <div className="f-bottom">
          <div className="f-copyright">
            &copy; {new Date().getFullYear()} MS Billings. All rights reserved.
          </div>
          
          <div className="f-legal">
            <a href="#" className="f-link f-link--small">Privacy Policy</a>
            <a href="#" className="f-link f-link--small">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
