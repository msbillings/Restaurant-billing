import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  {
    image: './bg1.jpg',
    titleStart: 'Smart ',
    highlight: 'Ordering',
    titleEnd: '',
    subtitle: 'Streamline your restaurant order management with our intuitive digital menu.'
  },
  {
    image: './bg2.jpg',
    titleStart: 'Real-Time ',
    highlight: 'Analytics',
    titleEnd: '',
    subtitle: 'Track your business performance instantly and make data-driven decisions.'
  },
  {
    image: './bg3.jpg',
    titleStart: '',
    highlight: 'AI Face',
    titleEnd: ' Attendance',
    subtitle: 'Touchless, secure clock-ins for your staff using advanced facial recognition.'
  },
  {
    image: './bg4.jpg',
    titleStart: 'Seamless ',
    highlight: 'Billing',
    titleEnd: '',
    subtitle: 'Lightning-fast, accurate invoicing designed for high-volume restaurants.'
  }
];

const BackgroundSlideshow = ({ children, formPosition = 'right' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Preload images to prevent black screens
    slides.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[currentIndex];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black flex items-center">
      {/* Background Slideshow */}
      <AnimatePresence initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0 z-0"
        >
          {/* Using img tag instead of background-image for better loading reliability */}
          <img 
            src={slide.image} 
            alt="Background" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark Overlay for readability and glassmorphism contrast */}
          <div className="absolute inset-0 bg-black/60" />
        </motion.div>
      </AnimatePresence>

      {/* Content Container */}
      <div className="relative z-10 w-full h-full min-h-screen flex flex-col md:flex-row">
        
        {/* Left Side */}
        <div className={`flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-24 ${formPosition === 'left' ? 'order-2 md:order-1' : 'order-1 md:order-1'}`}>
          {formPosition === 'right' ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl"
              >
                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl leading-tight">
                  {slide.titleStart}
                  <span className="text-orange-500">{slide.highlight}</span>
                  {slide.titleEnd}
                </h1>
                <p className="text-xl md:text-2xl text-gray-200 font-medium drop-shadow-lg">
                  {slide.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="w-full max-w-md mx-auto xl:mr-auto xl:ml-0">
              {children}
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className={`flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-24 ${formPosition === 'left' ? 'order-1 md:order-2' : 'order-2 md:order-2'}`}>
          {formPosition === 'right' ? (
            <div className="w-full max-w-md mx-auto xl:ml-auto xl:mr-0">
              {children}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl ml-auto text-right"
              >
                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl leading-tight">
                  {slide.titleStart}
                  <span className="text-orange-500">{slide.highlight}</span>
                  {slide.titleEnd}
                </h1>
                <p className="text-xl md:text-2xl text-gray-200 font-medium drop-shadow-lg">
                  {slide.subtitle}
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

      </div>
    </div>
  );
};

export default BackgroundSlideshow;
