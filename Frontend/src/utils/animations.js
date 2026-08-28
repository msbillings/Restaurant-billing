/**
 * Premium realistic 3D "Fly to Bill Summary / Cart" Animation
 *
 * Features:
 * - Dramatic high-arcing 3D curved Bezier trajectory
 * - Food image noticeably expands in size while in the air (scale ~1.75x) with 3D depth pop
 * - Soft 3D cloth/card wave rotation (rotateX, rotateY, skewX)
 * - Clean visual presentation: no distracting sparkle particles
 * - Precise UI delay: the cart and toast update ONLY when the item lands into the Bill Summary (~800ms)
 * - Destination micro-pulse on the Bill Summary panel
 * - Automatic and robust DOM element cleanup
 */

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

    // 2. Resolve destination coordinates (Bill Summary / Cart panel)
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
    const targetX = targetRect.left + Math.min(targetRect.width * 0.45, 150);
    const targetY = targetRect.top + Math.min(Math.max(targetRect.height * 0.32, 90), 220);

    const startX = sourceRect.left;
    const startY = sourceRect.top;
    const startW = sourceRect.width;
    const startH = sourceRect.height;

    const startCenterX = startX + startW / 2;
    const startCenterY = startY + startH / 2;

    const deltaX = targetX - startCenterX;
    const deltaY = targetY - startCenterY;

    // High upward curved arc height
    const isMobile = window.innerWidth < 1024;
    const arcHeight = isMobile
      ? Math.min(Math.max(Math.abs(deltaX) * 0.22, 60), 110)
      : Math.min(Math.max(Math.abs(deltaX) * 0.38, 140), 260);

    const maxScale = isMobile ? 1.45 : 1.75; // Noticeable scale increase in the air
    const rotationIntensity = isMobile ? 0.35 : 1.0;

    // 3. Create temporary animated clone of ONLY the food image with premium elevation
    const clone = document.createElement('div');
    clone.className = 'fly-to-cart-flying-clone';
    Object.assign(clone.style, {
      position: 'fixed',
      top: `${startY}px`,
      left: `${startX}px`,
      width: `${startW}px`,
      height: `${startH}px`,
      zIndex: '999999',
      pointerEvents: 'none',
      transformOrigin: 'center center',
      willChange: 'transform, opacity, box-shadow',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35), 0 8px 18px rgba(0, 0, 0, 0.2)',
      border: '3px solid #ffffff',
      backgroundColor: '#ffffff',
      backfaceVisibility: 'hidden'
    });

    if (resolvedSrc) {
      const img = document.createElement('img');
      img.src = resolvedSrc;
      img.alt = 'Flying food item';
      Object.assign(img.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
      });
      clone.appendChild(img);
    } else {
      const fallbackBadge = document.createElement('div');
      fallbackBadge.innerHTML = '🍽️';
      Object.assign(fallbackBadge.style, {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        background: 'linear-gradient(135deg, #ea580c, #f97316)',
        color: '#ffffff'
      });
      clone.appendChild(fallbackBadge);
    }

    document.body.appendChild(clone);

    const duration = 680; // Fast, punchy, fluid POS flight duration

    // 4. 3D Keyframe sequence: Lift & Dramatically Increase Size in Air -> High Parabolic Arc -> Dive into Cart
    const keyframes = [
      {
        // 0% - Start on card
        transform:
          'perspective(1200px) translate3d(0px, 0px, 0px) scale(1) rotate(0deg) rotateX(0deg) rotateY(0deg) skewX(0deg)',
        opacity: 1,
        boxShadow: '0 10px 24px rgba(0,0,0,0.25)'
      },
      {
        // 18% - Initial lift: Food image visibly pops out and grows in the air
        transform: `perspective(1200px) translate3d(${deltaX * 0.08}px, -50px, 120px) scale(${maxScale}) rotate(${5 * rotationIntensity}deg) rotateX(${18 * rotationIntensity}deg) rotateY(${-15 * rotationIntensity}deg) skewX(${-3 * rotationIntensity}deg)`,
        opacity: 1,
        boxShadow: '0 30px 65px rgba(0,0,0,0.45), 0 10px 25px rgba(0,0,0,0.25)',
        offset: 0.18
      },
      {
        // 42% - Arc Peak: high above the menu, enlarged, 3D tilt
        transform: `perspective(1200px) translate3d(${deltaX * 0.40}px, ${deltaY * 0.15 - arcHeight}px, 160px) scale(${maxScale}) rotate(${-8 * rotationIntensity}deg) rotateX(${24 * rotationIntensity}deg) rotateY(${16 * rotationIntensity}deg) skewX(${4 * rotationIntensity}deg)`,
        opacity: 0.98,
        boxShadow: '0 35px 75px rgba(0,0,0,0.42), 0 12px 28px rgba(0,0,0,0.2)',
        offset: 0.42
      },
      {
        // 68% - Gliding across towards the Bill Summary panel
        transform: `perspective(1200px) translate3d(${deltaX * 0.72}px, ${deltaY * 0.52 - arcHeight * 0.45}px, 90px) scale(${1 + (maxScale - 1) * 0.4}) rotate(${6 * rotationIntensity}deg) rotateX(${-14 * rotationIntensity}deg) rotateY(${10 * rotationIntensity}deg) skewX(${-3 * rotationIntensity}deg)`,
        opacity: 0.95,
        boxShadow: '0 22px 50px rgba(0,0,0,0.32)',
        offset: 0.68
      },
      {
        // 88% - Approaching destination, scaling down, aligning with cart
        transform: `perspective(1200px) translate3d(${deltaX * 0.92}px, ${deltaY * 0.86 - 8}px, 30px) scale(0.55) rotate(${-2 * rotationIntensity}deg) rotateX(${8 * rotationIntensity}deg) rotateY(${-4 * rotationIntensity}deg) skewX(${1 * rotationIntensity}deg)`,
        opacity: 0.82,
        boxShadow: '0 10px 22px rgba(0,0,0,0.2)',
        offset: 0.88
      },
      {
        // 100% - Quick shrink into cart/bill summary destination and disappear
        transform: `perspective(1200px) translate3d(${deltaX}px, ${deltaY}px, 0px) scale(0.15) rotate(0deg) rotateX(0deg) rotateY(0deg) skewX(0deg)`,
        opacity: 0,
        boxShadow: '0 0px 0px rgba(0,0,0,0)'
      }
    ];

    const animation = clone.animate(keyframes, {
      duration: duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards'
    });

    let callbackFired = false;
    const fireLandCallback = () => {
      if (!callbackFired) {
        callbackFired = true;
        if (typeof onLandCallback === 'function') {
          onLandCallback();
        }
      }
    };

    animation.onfinish = () => {
      // Add the item to cart exactly upon landing
      fireLandCallback();
      clone.remove();
    };
  } catch (err) {
    console.error('flyItemToCart animation error:', err);
    if (typeof onLandCallback === 'function') onLandCallback();
  }
};
