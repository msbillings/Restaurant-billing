import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home',        href: '#home'        },
  { label: 'Experience',  href: '#experience'  },
  { label: 'Food',        href: '#food'        },
  { label: 'Features',    href: '#features'    },
  { label: 'Gallery',     href: '#gallery'     },
  { label: 'MS Billings', href: '#ms-billings' },
  { label: 'Contact',     href: '#contact'     },
];

const Navbar = ({ onLaunchApp, isLoggedIn }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const observerRef = useRef(null);

  useEffect(() => {
    const sectionIds = NAV_LINKS.map(l => l.href.slice(1));

    const handleIntersect = (entries) => {
      // Find the entry with the greatest intersection ratio that is intersecting
      let best = null;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
      }
      if (best) {
        setActiveSection(best.target.id);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    });

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const handleNavClick = (e, href) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(href.slice(1));
    }
    setMobileMenuOpen(false);
  };

  const handleLaunch = (target = 'floor') => {
    setMobileMenuOpen(false);
    if (onLaunchApp) {
      onLaunchApp(target);
    } else {
      window.location.href = `/${target}`;
    }
  };

  return (
    <nav className="landing-navbar">
      <div className="landing-container">
        <div
          className="navbar-logo"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveSection('home');
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
        >
          MS Billings<span style={{ color: '#c8963e' }}>.</span>
        </div>

        <ul className={`navbar-links ${mobileMenuOpen ? 'is-open' : ''}`}>
          {NAV_LINKS.map(({ label, href }) => (
            <li key={href}>
              <a
                href={href}
                className={activeSection === href.slice(1) ? 'active' : ''}
                onClick={(e) => handleNavClick(e, href)}
              >
                {label}
              </a>
            </li>
          ))}
          <li className="mobile-only-nav-action">
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => handleLaunch('floor')}
            >
              {isLoggedIn ? 'Open POS (Active)' : 'Launch POS / Login'}
            </button>
          </li>
        </ul>

        <div className="navbar-actions">
          {!isLoggedIn && (
            <button className="btn-login" onClick={() => handleLaunch('login')}>
              Login
            </button>
          )}
          <button className="btn-primary" onClick={() => handleLaunch('floor')}>
            {isLoggedIn ? 'Open POS' : 'Launch POS'}
          </button>
          <button
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
