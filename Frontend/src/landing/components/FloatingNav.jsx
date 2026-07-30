import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import './FloatingNav.css';

const FloatingNav = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show when scrolled down a bit
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className={`floating-nav ${isVisible ? 'is-visible' : ''}`} aria-hidden={!isVisible}>
      <button className="floating-btn" onClick={scrollToTop} aria-label="Scroll to Top" tabIndex={isVisible ? 0 : -1}>
        <ArrowUp size={20} />
      </button>
      <div className="floating-divider" aria-hidden="true" />
      <button className="floating-btn" onClick={scrollToBottom} aria-label="Scroll to Bottom" tabIndex={isVisible ? 0 : -1}>
        <ArrowDown size={20} />
      </button>
    </div>
  );
};

export default FloatingNav;
