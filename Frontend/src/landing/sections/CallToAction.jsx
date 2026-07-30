import React, { useState, memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowRight, LogIn, Sparkles, Send } from 'lucide-react';
import './CallToAction.css';

/* ─── Animation Helpers ──────────────────────────────────────────── */

const inView = (delay = 0, dir = 'up', duration = 0.9) => ({
  initial: {
    opacity: 0,
    y: dir === 'up' ? 40 : dir === 'down' ? -40 : 0,
  },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, margin: '-60px' },
  transition: { duration, ease: [0.16, 1, 0.3, 1], delay },
});

/* ─── Main Section ───────────────────────────────────────────────── */

const CallToAction = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    restaurantName: '',
    phone: '',
    message: ''
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    if (name === 'phone') {
      value = value.replace(/\D/g, ''); // Only digits
      if (value.length > 10) value = value.slice(0, 10);
    } else if (name === 'name') {
      value = value.replace(/[^A-Za-z\s-]/g, ''); // Only letters, spaces, hyphens
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const response = await fetch('http://localhost:5002/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', restaurantName: '', phone: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setStatus('error');
    }
  };

  return (
    <section id="cta" className="cta-section" aria-label="Call to Action">
      <div className="landing-container">
        
        <Motion.div className="cta-panel" {...inView(0, 'up')}>
          
          {/* Panel Background Decor */}
          <div className="cta-panel__bg" aria-hidden="true">
            <div className="cta-panel__glow cta-panel__glow--1" />
            <div className="cta-panel__glow cta-panel__glow--2" />
            <div className="cta-panel__texture" />
          </div>

          <div className="cta-panel__content">
            
            {/* Left Column: Text & Actions */}
            <div className="cta-panel__left">
              <Motion.div className="cta-icon-wrap" {...inView(0.1, 'up')}>
                <Sparkles size={28} className="cta-icon" aria-hidden="true" />
              </Motion.div>

              <Motion.h2 className="cta-heading" {...inView(0.2, 'up')}>
                Modern Restaurant Management
                <br />
                <span className="cta-heading__accent">Starts Here.</span>
              </Motion.h2>

              <Motion.p className="cta-subheading" {...inView(0.3, 'up')}>
                Join the world's most elegant dining establishments. Elevate your operations, 
                delight your guests, and unlock new growth with MS Billings.
              </Motion.p>

              <Motion.div className="cta-actions" {...inView(0.4, 'up')}>
                <a href="/signup" className="cta-btn cta-btn--primary" aria-label="Get Started">
                  <span className="cta-btn__text">Get Started</span>
                  <ArrowRight strokeWidth={1.5} size={18} className="cta-btn__icon" aria-hidden="true" />
                  <div className="cta-btn__shine" aria-hidden="true" />
                </a>
                
                <a href="/login" className="cta-btn cta-btn--secondary" aria-label="Login">
                  <span className="cta-btn__text">Login</span>
                  <LogIn size={18} className="cta-btn__icon" aria-hidden="true" />
                </a>
              </Motion.div>
            </div>

            {/* Right Column: Contact Form */}
            <Motion.div className="cta-panel__right" {...inView(0.3, 'up')}>
              <form className="cta-form" onSubmit={handleSubmit}>
                <h3 className="cta-form__title">Get in Touch</h3>
                
                <div className="cta-form__group-row">
                  <div className="cta-form__group">
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required maxLength="50" placeholder="Full Name *" className="cta-form__input" />
                  </div>
                  <div className="cta-form__group">
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required maxLength="100" placeholder="Email Address *" className="cta-form__input" />
                  </div>
                </div>

                <div className="cta-form__group-row">
                  <div className="cta-form__group">
                    <input type="text" name="restaurantName" value={formData.restaurantName} onChange={handleChange} maxLength="100" placeholder="Restaurant Name" className="cta-form__input" />
                  </div>
                  <div className="cta-form__group">
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} maxLength="10" placeholder="Phone Number" className="cta-form__input" />
                  </div>
                </div>

                <div className="cta-form__group">
                  <textarea name="message" value={formData.message} onChange={handleChange} required maxLength="1000" placeholder="How can we help you? *" className="cta-form__input cta-form__textarea"></textarea>
                </div>

                <button type="submit" className="cta-btn cta-btn--submit" disabled={status === 'loading'}>
                  <span className="cta-btn__text">{status === 'loading' ? 'Sending...' : 'Send Message'}</span>
                  <Send size={16} className="cta-btn__icon" aria-hidden="true" />
                  <div className="cta-btn__shine" aria-hidden="true" />
                </button>
                
                {status === 'success' && <p className="cta-form__msg cta-form__msg--success">Message sent successfully!</p>}
                {status === 'error' && <p className="cta-form__msg cta-form__msg--error">Failed to send message. Please try again.</p>}
              </form>
            </Motion.div>

          </div>
          
        </Motion.div>

      </div>
    </section>
  );
};

export default memo(CallToAction);
