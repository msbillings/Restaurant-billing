import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

const BACKGROUND_CLEANUP_MS = 4000; // 4 seconds to silently clean up component in background

const PaymentSuccessScreen = ({ paymentData, onDone }) => {
  const doneCalledRef = useRef(false);

  const mode = paymentData?.mode || "Cash";
  const isUnpaid = mode === "Unpaid";

  // Silently unmount the invisible component after confetti finishes so it can fire again next time
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        onDone?.();
      }
    }, BACKGROUND_CLEANUP_MS);

    return () => clearTimeout(timer);
  }, [onDone]);

  // Google Pay / Paytm style 3D Canvas Confetti
  useEffect(() => {
    if (isUnpaid) return;

    const gpayColors = ["#22c55e", "#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ec4899", "#00baf2", "#ffffff"];

    // 1. Center pop from checkmark
    confetti({
      particleCount: 80,
      spread: 100,
      startVelocity: 38,
      origin: { y: 0.42 },
      colors: gpayColors,
      scalar: 1.05,
      zIndex: 9999,
      disableForReducedMotion: true,
    });

    // 2. Dual corner cannon burst (Google Pay / Paytm 3D sprinkle style)
    const t1 = setTimeout(() => {
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 65,
        origin: { x: 0.05, y: 0.6 },
        colors: gpayColors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 45,
        angle: 120,
        spread: 65,
        origin: { x: 0.95, y: 0.6 },
        colors: gpayColors,
        zIndex: 9999,
      });
    }, 220);

    return () => clearTimeout(t1);
  }, [isUnpaid]);

  return null; // Return null so the UI modal is completely removed, but hooks (confetti & timer) still run
};

export default PaymentSuccessScreen;
