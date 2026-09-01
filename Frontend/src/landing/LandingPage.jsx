import React, { Suspense, lazy } from 'react';
import { MotionConfig } from 'framer-motion';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import About from './sections/About';
import Experience from './sections/Experience';
import FoodShowcase from './sections/FoodShowcase';
import RestaurantFeatures from './sections/RestaurantFeatures';
import MSBillingsFeatures from './sections/MSBillingsFeatures';
import FloatingNav from './components/FloatingNav';
import './Landing.css';

// Lazy load below-the-fold components
const Gallery = lazy(() => import('./sections/Gallery'));
const Testimonials = lazy(() => import('./sections/Testimonials'));
const CallToAction = lazy(() => import('./sections/CallToAction'));
const Footer = lazy(() => import('./sections/Footer'));

const LandingPage = ({ onLaunchApp, isLoggedIn }) => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-layout">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Navbar onLaunchApp={onLaunchApp} isLoggedIn={isLoggedIn} />
        <main id="main-content">
          <Hero onLaunchApp={onLaunchApp} isLoggedIn={isLoggedIn} />
          <Experience />
          <About />
          <FoodShowcase />
          <RestaurantFeatures />
          <MSBillingsFeatures />
          
          <Suspense fallback={<div className="lazy-fallback"></div>}>
            <Gallery />
            <Testimonials />
            <CallToAction onLaunchApp={onLaunchApp} />
          </Suspense>
        </main>
        
        <Suspense fallback={<div className="lazy-fallback"></div>}>
          <Footer />
        </Suspense>
        <FloatingNav />
      </div>
    </MotionConfig>
  );
};

export default LandingPage;
