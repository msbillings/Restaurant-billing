/**
 * Premium 3D "Fly to Cart / Bill Summary" Animation
 *
 * Features:
 * - Clean borderless image clone (No white border / background)
 * - Majestic high-arcing 3D parabolic trajectory
 * - Mid-air floating presence: item expands (1.8x) with dynamic 3D pitch/roll & glowing aura
 * - Perfectly paced timing (~880ms) so the flight is clearly visible and gratifying
 * - Cart landing absorption effect with micro-pulse feedback
 */

/**
 * Helper to auto-detect category, icon, gradient, and theme from item name and type
 */
export const getFoodCategoryVisual = (name = '', type = '') => {
  const n = String(name || '').toLowerCase();
  const t = String(type || '').toLowerCase();

  // Beverages & Drinks
  if (
    n.includes('drink') || n.includes('juice') || n.includes('shake') ||
    n.includes('water') || n.includes('soda') || n.includes('tea') ||
    n.includes('coffee') || n.includes('bull') || n.includes('bottle') ||
    n.includes('cola') || n.includes('sprite') || n.includes('pepsi') ||
    n.includes('mojito') || n.includes('lassi') || n.includes('beverage') ||
    n.includes('horlicks') || n.includes('bournvita') || n.includes('milk')
  ) {
    return {
      icon: '🍹',
      label: 'Beverage',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(6, 182, 212, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-cyan-500/10 via-blue-500/5 to-transparent',
      textAccent: 'text-cyan-400'
    };
  }

  // Desserts, Sweets & Bakery
  if (
    n.includes('jamun') || n.includes('sweet') || n.includes('dessert') ||
    n.includes('desert') || n.includes('ice cream') || n.includes('icecream') ||
    n.includes('cake') || n.includes('pastry') || n.includes('halwa') ||
    n.includes('kheer') || n.includes('malai') || n.includes('rasgulla') ||
    n.includes('falooda') || n.includes('pudding') || n.includes('delight') ||
    n.includes('brownie') || n.includes('gulab')
  ) {
    return {
      icon: '🍨',
      label: 'Dessert',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(244, 63, 94, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-rose-500/10 via-orange-500/5 to-transparent',
      textAccent: 'text-rose-400'
    };
  }

  // Biryani, Rice, Pulao & Mandi
  if (
    n.includes('biryani') || n.includes('mandi') || n.includes('rice') ||
    n.includes('pulao') || n.includes('zurbian') || n.includes('chowki') ||
    n.includes('khichdi') || n.includes('fried rice')
  ) {
    return {
      icon: '🍛',
      label: 'Rice & Mandi',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
      textAccent: 'text-amber-400'
    };
  }

  // Non-Veg Starters & Grills
  if (
    n.includes('chicken') || n.includes('mutton') || n.includes('fish') ||
    n.includes('prawn') || n.includes('kebab') || n.includes('tikka') ||
    n.includes('tandoori') || n.includes('grill') || n.includes('meat') ||
    n.includes('egg') || n.includes('leg') || n.includes('wings') ||
    t === 'non-veg'
  ) {
    return {
      icon: '🍗',
      label: 'Non-Veg',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-red-500/10 via-rose-500/5 to-transparent',
      textAccent: 'text-red-400'
    };
  }

  // Breads, Naan & Rotis
  if (
    n.includes('roti') || n.includes('naan') || n.includes('paratha') ||
    n.includes('kulcha') || n.includes('bread') || n.includes('chapati') ||
    n.includes('puri') || n.includes('bhatura')
  ) {
    return {
      icon: '🫓',
      label: 'Breads',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(217, 119, 6, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-yellow-500/10 via-amber-500/5 to-transparent',
      textAccent: 'text-amber-400'
    };
  }

  // Soups & Bowls
  if (
    n.includes('soup') || n.includes('shorba') || n.includes('broth') || n.includes('manchow')
  ) {
    return {
      icon: '🥣',
      label: 'Hot Soup',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(251, 146, 60, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-orange-500/10 via-amber-500/5 to-transparent',
      textAccent: 'text-orange-400'
    };
  }

  // Veg & Salads
  if (
    n.includes('veg') || n.includes('paneer') || n.includes('mushroom') ||
    n.includes('gobi') || n.includes('salad') || n.includes('dal') ||
    t === 'veg'
  ) {
    return {
      icon: '🥗',
      label: 'Veg Special',
      shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
      cardBg: 'from-emerald-500/10 via-green-500/5 to-transparent',
      textAccent: 'text-emerald-400'
    };
  }

  // Default Gourmet
  return {
    icon: '🍲',
    label: 'Delicious',
    shadow: '0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(249, 115, 22, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
    cardBg: 'from-orange-500/10 via-amber-500/5 to-transparent',
    textAccent: 'text-orange-400'
  };
};

export const flyItemToCart = (sourceElement, targetElement, imageUrl, onLandCallback) => {
  if (!sourceElement) {
    if (typeof onLandCallback === 'function') onLandCallback();
    return;
  }

  try {
    // 1. Capture exact clicked item's image and screen position
    const imgElement = sourceElement.querySelector('img');
    const sourceRect = (imgElement && imgElement.offsetWidth > 0 ? imgElement : sourceElement).getBoundingClientRect();

    if (sourceRect.width === 0 || sourceRect.height === 0) {
      if (typeof onLandCallback === 'function') onLandCallback();
      return;
    }

    const resolvedSrc = imgElement?.currentSrc || imgElement?.src || imageUrl || '';
    const startCenterX = sourceRect.left + sourceRect.width / 2;
    const startCenterY = sourceRect.top + sourceRect.height / 2;

    // 2. Identify platform & target (Mobile vs Desktop separation)
    const mobileCartTab =
      document.querySelector('[data-mobile-cart-tab]') ||
      document.querySelector('#mobile-cart-tab');

    const billSummaryContainer = document.querySelector('.bill-summary-container');
    const isDesktopCartVisible = billSummaryContainer && billSummaryContainer.offsetParent !== null;

    const isMobile =
      (typeof window !== 'undefined' && window.innerWidth < 768) ||
      (!isDesktopCartVisible && !!mobileCartTab);

    let targetX, targetY, flyerSize, duration, keyframes, rotationIntensity;

    if (isMobile) {
      // ==========================================
      // 📱 MOBILE-SPECIFIC 3D FLIGHT TO TOP CART TAB
      // ==========================================
      let mobileTargetRect = mobileCartTab?.getBoundingClientRect();
      if (!mobileTargetRect || mobileTargetRect.width === 0 || mobileTargetRect.height === 0) {
        mobileTargetRect = {
          left: window.innerWidth * 0.5,
          top: 60,
          width: 120,
          height: 38
        };
      }

      // Target center of the mobile Cart tab
      targetX = mobileTargetRect.left + mobileTargetRect.width / 2;
      targetY = mobileTargetRect.top + mobileTargetRect.height / 2;

      const deltaX = targetX - startCenterX;
      const deltaY = targetY - startCenterY;

      flyerSize = 88;
      duration = 880; // Extended smooth air-hang float
      rotationIntensity = 0.55;

      keyframes = [
        {
          // 0% - Start at tapped card
          transform: 'perspective(900px) translate3d(0px, 0px, 0px) scale(1) rotate(0deg) rotateX(0deg)',
          opacity: 1,
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))'
        },
        {
          // 18% - Dynamic 3D Pop Out: Lifts toward screen, expands in the air
          transform: `perspective(900px) translate3d(${deltaX * 0.12}px, -28px, 90px) scale(1.30) rotate(${6 * rotationIntensity}deg) rotateX(16deg) rotateY(-10deg)`,
          opacity: 1,
          filter: 'drop-shadow(0 25px 45px rgba(0,0,0,0.5)) drop-shadow(0 0 22px rgba(249,115,22,0.5))',
          offset: 0.18
        },
        {
          // 36% - Air Hang Apex: Floats high in the air, max size & prominent 3D presence
          transform: `perspective(900px) translate3d(${deltaX * 0.32}px, ${deltaY * 0.20 - 18}px, 110px) scale(1.35) rotate(${-6 * rotationIntensity}deg) rotateX(18deg) rotateY(12deg)`,
          opacity: 1,
          filter: 'drop-shadow(0 30px 55px rgba(0,0,0,0.6)) drop-shadow(0 0 28px rgba(249,115,22,0.6))',
          offset: 0.36
        },
        {
          // 60% - Extended Mid-Air Float & Hang Delay: Lingers hovering in the air before diving
          transform: `perspective(900px) translate3d(${deltaX * 0.56}px, ${deltaY * 0.42 - 12}px, 95px) scale(1.28) rotate(${5 * rotationIntensity}deg) rotateX(-12deg) rotateY(-8deg)`,
          opacity: 0.98,
          filter: 'drop-shadow(0 24px 45px rgba(0,0,0,0.5)) drop-shadow(0 0 24px rgba(249,115,22,0.45))',
          offset: 0.60
        },
        {
          // 80% - Smooth Swoop Acceleration towards Cart Tab
          transform: `perspective(900px) translate3d(${deltaX * 0.82}px, ${deltaY * 0.78}px, 50px) scale(0.90) rotate(${-3 * rotationIntensity}deg) rotateX(8deg)`,
          opacity: 0.95,
          filter: 'drop-shadow(0 14px 25px rgba(0,0,0,0.35))',
          offset: 0.80
        },
        {
          // 92% - Aligning with Tab & Shrinking
          transform: `perspective(900px) translate3d(${deltaX * 0.94}px, ${deltaY * 0.93}px, 20px) scale(0.48) rotate(${2 * rotationIntensity}deg)`,
          opacity: 0.88,
          filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.25))',
          offset: 0.92
        },
        {
          // 100% - Clean Tab Absorption
          transform: `perspective(900px) translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.08) rotate(0deg)`,
          opacity: 0,
          filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))'
        }
      ];
    } else {
      // ==========================================
      // 💻 DESKTOP 3D FLIGHT TO BILL SUMMARY PANEL
      // ==========================================
      let target = targetElement;
      if (!target || typeof target === 'string') {
        target =
          document.querySelector('.bill-summary-container') ||
          document.querySelector('#bill-summary-container') ||
          document.querySelector('.bill-summary-panel') ||
          document.querySelector('#bill-summary-target') ||
          document.querySelector('[data-bill-summary]');
      }

      let targetRect = null;
      if (target && typeof target.getBoundingClientRect === 'function') {
        targetRect = target.getBoundingClientRect();
      }

      if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
        targetRect = {
          left: window.innerWidth - Math.min(window.innerWidth * 0.3, 380),
          top: 150,
          width: 320,
          height: 400
        };
      }

      // Destination target point inside Bill Summary (items area)
      targetX = targetRect.left + Math.min(targetRect.width * 0.45, 150);
      targetY = targetRect.top + Math.min(Math.max(targetRect.height * 0.32, 90), 220);

      const deltaX = targetX - startCenterX;
      const deltaY = targetY - startCenterY;

      flyerSize = 124;
      duration = 980; // Extended smooth air hang for desktop
      rotationIntensity = 0.85;

      const safeMinY = 78;
      const maxUpwardLift = Math.max(startCenterY - safeMinY - flyerSize / 2, 0);
      const arcHeight = Math.min(Math.abs(deltaX) * 0.26, maxUpwardLift, 90);

      keyframes = [
        {
          // 0% - Start position at card center
          transform:
            'perspective(1200px) translate3d(0px, 0px, 0px) scale(1) rotate(0deg) rotateX(0deg) rotateY(0deg)',
          opacity: 1,
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
        },
        {
          // 18% - Dynamic 3D Pop Out: Lifts toward the screen with initial pitch
          transform: `perspective(1200px) translate3d(${deltaX * 0.14}px, ${-arcHeight * 0.65}px, 95px) scale(1.28) rotate(${7 * rotationIntensity}deg) rotateX(${18 * rotationIntensity}deg) rotateY(${-16 * rotationIntensity}deg)`,
          opacity: 1,
          filter: 'drop-shadow(0 24px 45px rgba(0,0,0,0.5)) drop-shadow(0 0 22px rgba(249,115,22,0.45))',
          offset: 0.18
        },
        {
          // 36% - Air Hang Apex Start: Floats high in the air, max size & 3D roll
          transform: `perspective(1200px) translate3d(${deltaX * 0.38}px, ${deltaY * 0.12 - arcHeight}px, 145px) scale(1.38) rotate(${-8 * rotationIntensity}deg) rotateX(${24 * rotationIntensity}deg) rotateY(${20 * rotationIntensity}deg)`,
          opacity: 1,
          filter: 'drop-shadow(0 35px 65px rgba(0,0,0,0.6)) drop-shadow(0 0 32px rgba(249,115,22,0.6))',
          offset: 0.36
        },
        {
          // 62% - Extended Mid-Air Float & Glide Delay: Lingers gracefully suspended in mid-air
          transform: `perspective(1200px) translate3d(${deltaX * 0.64}px, ${deltaY * 0.30 - arcHeight * 0.70}px, 125px) scale(1.32) rotate(${8 * rotationIntensity}deg) rotateX(${-18 * rotationIntensity}deg) rotateY(${-14 * rotationIntensity}deg)`,
          opacity: 0.98,
          filter: 'drop-shadow(0 30px 55px rgba(0,0,0,0.5)) drop-shadow(0 0 26px rgba(249,115,22,0.48))',
          offset: 0.62
        },
        {
          // 78% - Gentle Descent Acceleration towards Cart
          transform: `perspective(1200px) translate3d(${deltaX * 0.84}px, ${deltaY * 0.65 - arcHeight * 0.20}px, 60px) scale(1.02) rotate(${-4 * rotationIntensity}deg) rotateX(${10 * rotationIntensity}deg) rotateY(${8 * rotationIntensity}deg)`,
          opacity: 0.94,
          filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.35))',
          offset: 0.78
        },
        {
          // 90% - Aligning with Bill Summary target
          transform: `perspective(1200px) translate3d(${deltaX * 0.94}px, ${deltaY * 0.9}px, 20px) scale(0.55) rotate(${2 * rotationIntensity}deg)`,
          opacity: 0.86,
          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.25))',
          offset: 0.90
        },
        {
          // 100% - Clean Cart Absorption
          transform: `perspective(1200px) translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.08) rotate(0deg)`,
          opacity: 0,
          filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))'
        }
      ];
    }

    const isFallback = !resolvedSrc;
    const cloneLeft = startCenterX - flyerSize / 2;
    const cloneTop = startCenterY - flyerSize / 2;

    // Extract item context for smart fallback badge
    const itemName = sourceElement?.querySelector('span.line-clamp-2, h3, [data-item-name]')?.textContent?.trim() || '';
    const itemType = sourceElement?.querySelector('[title="Veg"], [title="Non-Veg"]')?.getAttribute('title') || '';
    const visual = getFoodCategoryVisual(itemName, itemType);

    // Inject 3D Flag-Flutter & Spherical Curve Styles if not already present
    if (!document.getElementById('resto-fly-3d-curve-styles')) {
      const styleTag = document.createElement('style');
      styleTag.id = 'resto-fly-3d-curve-styles';
      styleTag.innerHTML = `
        @keyframes flagClothWave {
          0% {
            transform: perspective(600px) rotateY(-14deg) rotateX(12deg) skewY(-3.5deg) scale(1);
            border-radius: 20px 26px 18px 24px;
            filter: drop-shadow(-4px 10px 18px rgba(0,0,0,0.45));
          }
          25% {
            transform: perspective(600px) rotateY(18deg) rotateX(-10deg) skewY(4deg) scale(1.04);
            border-radius: 28px 18px 26px 16px;
            filter: drop-shadow(6px 14px 24px rgba(0,0,0,0.55));
          }
          50% {
            transform: perspective(600px) rotateY(-12deg) rotateX(16deg) skewY(-4.5deg) scale(1.02);
            border-radius: 16px 28px 22px 26px;
            filter: drop-shadow(-6px 12px 20px rgba(0,0,0,0.48));
          }
          75% {
            transform: perspective(600px) rotateY(15deg) rotateX(-14deg) skewY(3.5deg) scale(1.05);
            border-radius: 26px 20px 28px 18px;
            filter: drop-shadow(5px 16px 26px rgba(0,0,0,0.52));
          }
          100% {
            transform: perspective(600px) rotateY(-14deg) rotateX(12deg) skewY(-3.5deg) scale(1);
            border-radius: 20px 26px 18px 24px;
            filter: drop-shadow(-4px 10px 18px rgba(0,0,0,0.45));
          }
        }

        @keyframes flagShineSweep {
          0% {
            transform: translateX(-140%) rotate(28deg);
            opacity: 0;
          }
          30% {
            opacity: 0.85;
          }
          60% {
            opacity: 0.85;
          }
          100% {
            transform: translateX(240%) rotate(28deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styleTag);
    }

    // 3. Create temporary animated clone (generous size, 3D perspective, sleek borderless)
    const clone = document.createElement('div');
    clone.className = 'fly-to-cart-flying-clone';
    Object.assign(clone.style, {
      position: 'fixed',
      top: `${cloneTop}px`,
      left: `${cloneLeft}px`,
      width: `${flyerSize}px`,
      height: `${flyerSize}px`,
      zIndex: '999999',
      pointerEvents: 'none',
      transformOrigin: 'center center',
      willChange: 'transform, opacity, filter',
      borderRadius: '22px',
      backgroundColor: 'transparent',
      boxShadow: isFallback
        ? '0 25px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(249, 115, 22, 0.4)'
        : '0 25px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(249, 115, 22, 0.35)',
      backfaceVisibility: 'hidden'
    });

    // Inner 3D Flag/Cloth Waving Container
    const innerWaveContainer = document.createElement('div');
    Object.assign(innerWaveContainer.style, {
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '22px',
      animation: 'flagClothWave 0.75s ease-in-out infinite alternate',
      transformStyle: 'preserve-3d',
      willChange: 'transform, border-radius'
    });

    if (resolvedSrc) {
      const img = document.createElement('img');
      img.src = resolvedSrc;
      img.alt = 'Flying food item';
      Object.assign(img.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        borderRadius: 'inherit'
      });
      innerWaveContainer.appendChild(img);

      // 3D Spherical/Cylindrical Lens & Flag-Wave Highlight Shading Layer
      const sphereLensShading = document.createElement('div');
      Object.assign(sphereLensShading.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.08) 45%, rgba(0,0,0,0.42) 100%), linear-gradient(135deg, rgba(255,255,255,0.15), rgba(0,0,0,0.3))',
        pointerEvents: 'none',
        mixBlendMode: 'overlay'
      });
      innerWaveContainer.appendChild(sphereLensShading);

      // Dynamic Specular Light Glint Wave sweeping across the fluttering surface
      const shineGlint = document.createElement('div');
      Object.assign(shineGlint.style, {
        position: 'absolute',
        top: '-40%',
        left: '-40%',
        width: '180%',
        height: '180%',
        background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%)',
        animation: 'flagShineSweep 1.1s ease-in-out infinite',
        pointerEvents: 'none',
        borderRadius: 'inherit'
      });
      innerWaveContainer.appendChild(shineGlint);
      clone.appendChild(innerWaveContainer);
    } else {
      const fallbackBadge = document.createElement('div');
      fallbackBadge.innerHTML = `
        <div style="font-size: ${isMobile ? '36px' : '52px'}; line-height: 1; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5)); transform: scale(1.1);">${visual.icon}</div>
      `;
      Object.assign(fallbackBadge.style, {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'inherit',
        background: 'radial-gradient(circle at 35% 35%, #27272a 0%, #18181b 60%, #09090b 100%)',
        boxShadow: visual.shadow,
        padding: '8px'
      });
      innerWaveContainer.appendChild(fallbackBadge);
      clone.appendChild(innerWaveContainer);
    }

    document.body.appendChild(clone);

    const animation = clone.animate(keyframes, {
      duration: duration,
      easing: isMobile ? 'cubic-bezier(0.25, 0.9, 0.3, 1)' : 'cubic-bezier(0.2, 0.85, 0.35, 1)',
      fill: 'forwards'
    });

    let callbackFired = false;
    const fireLandCallback = () => {
      if (!callbackFired) {
        callbackFired = true;

        // Mobile cart tab micro-bounce feedback on landing
        if (isMobile && mobileCartTab) {
          try {
            mobileCartTab.animate([
              { transform: 'scale(1)' },
              { transform: 'scale(1.12)', filter: 'drop-shadow(0 0 12px rgba(249,115,22,0.7))' },
              { transform: 'scale(0.96)' },
              { transform: 'scale(1.03)' },
              { transform: 'scale(1)' }
            ], {
              duration: 380,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            });

            const badge = mobileCartTab.querySelector('[data-mobile-cart-badge]');
            if (badge) {
              badge.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.45)', backgroundColor: '#f97316' },
                { transform: 'scale(1)' }
              ], {
                duration: 320,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              });
            }
          } catch (_) {}
        }

        if (typeof onLandCallback === 'function') {
          onLandCallback();
        }
      }
    };

    animation.onfinish = () => {
      fireLandCallback();
      clone.remove();
    };
  } catch (err) {
    console.error('flyItemToCart animation error:', err);
    if (typeof onLandCallback === 'function') onLandCallback();
  }
};

