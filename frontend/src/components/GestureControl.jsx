import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

export default function GestureControl({ active, onFreezeChange }) {
  const [status, setStatus] = useState("Gesture control: waiting…");
  const [lastGesture, setLastGesture] = useState("none");

  const rafRef = useRef(null);
  const handsRef = useRef(null);

  const frozenRef = useRef(false);
  const lastFireRef = useRef(0);
  const COOLDOWN_MS = 900;

  const lastStatusRef = useRef("");
  const lastGestureRef = useRef("none");
  const lastUiUpdateRef = useRef(0);
  const UI_THROTTLE_MS = 250;

  function isOpenPalm(lm) {
    const tipIds = [8, 12, 16, 20];
    const pipIds = [6, 10, 14, 18];

    let extended = 0;
    for (let i = 0; i < tipIds.length; i++) {
      if (lm[tipIds[i]].y < lm[pipIds[i]].y) extended++;
    }

    const spread = Math.abs(lm[20].x - lm[8].x);
    return extended >= 3 && spread > 0.18;
  }

  function isThumbsUp(lm) {
    const thumbUp = lm[4].y < lm[3].y;

    const tipIds = [8, 12, 16, 20];
    const pipIds = [6, 10, 14, 18];

    let folded = 0;
    for (let i = 0; i < tipIds.length; i++) {
      if (lm[tipIds[i]].y > lm[pipIds[i]].y) folded++;
    }

    return thumbUp && folded >= 2;
  }

  function updateUI(nextStatus, nextGesture = null, force = false) {
    const now = Date.now();

    if (!force && now - lastUiUpdateRef.current < UI_THROTTLE_MS) return;

    if (nextStatus && nextStatus !== lastStatusRef.current) {
      lastStatusRef.current = nextStatus;
      setStatus(nextStatus);
      lastUiUpdateRef.current = now;
    }

    if (nextGesture && nextGesture !== lastGestureRef.current) {
      lastGestureRef.current = nextGesture;
      setLastGesture(nextGesture);
      lastUiUpdateRef.current = now;
    }
  }

  function fireFreeze(nextFrozen, gestureName) {
    const now = Date.now();
    if (now - lastFireRef.current < COOLDOWN_MS) return;

    lastFireRef.current = now;
    frozenRef.current = nextFrozen;

    updateUI(
      nextFrozen
        ? "Palm detected → FREEZE (modes/highlights locked)"
        : "Thumbs up detected → UNFREEZE (live again)",
      gestureName,
      true
    );

    onFreezeChange?.(nextFrozen, { source: "gesture", gesture: gestureName });
  }

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      handsRef.current = null;
      frozenRef.current = false;

      lastStatusRef.current = "";
      lastGestureRef.current = "none";
      lastUiUpdateRef.current = 0;

      setLastGesture("none");
      setStatus("Gesture control: inactive");
      return;
    }

    let cancelled = false;

    const getWebgazerVideo = () => document.getElementById("webgazerVideoFeed");

    async function init() {
      try {
        updateUI("Gesture control: initializing… (waiting for WebGazer video)", null, true);

        let tries = 0;
        let video = getWebgazerVideo();
        while ((!video || video.readyState < 2) && tries < 60) {
          await new Promise((r) => setTimeout(r, 100));
          tries++;
          video = getWebgazerVideo();
        }

        if (cancelled) return;

        if (!video) {
          updateUI("Gesture control: WebGazer video not found (#webgazerVideoFeed).", null, true);
          return;
        }

        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
          selfieMode: true,
        });

        hands.onResults((results) => {
          if (cancelled) return;

          const lms = results?.multiHandLandmarks?.[0];

          if (frozenRef.current) {
            if (lms && isThumbsUp(lms)) {
              fireFreeze(false, "thumbs_up");
              return;
            }
            updateUI("Frozen (show 👍 to continue)");
            return;
          }

          if (!lms) {
            updateUI("Gesture control: show ✋ to freeze or 👍 to continue");
            return;
          }

          if (isThumbsUp(lms)) {
            updateUI("👍 detected (already live)", "thumbs_up");
            return;
          }

          if (isOpenPalm(lms)) {
            fireFreeze(true, "palm");
            return;
          }

          updateUI("Gesture control ready ✅ (✋ freeze / 👍 unfreeze)");
        });

        handsRef.current = hands;
        updateUI("Gesture control ready ✅ (✋ freeze / 👍 unfreeze)", null, true);

        const loop = async () => {
          if (cancelled) return;

          try {
            if (video.readyState >= 2) {
              await hands.send({ image: video });
            }
          } catch (e) {
            console.error("[GestureControl] hands.send error:", e);
            updateUI("Gesture control error (check console)");
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.error("[GestureControl] init error:", e);
        updateUI("Gesture control init failed (check console)", null, true);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      handsRef.current = null;
    };
  }, [active, onFreezeChange]);

  return (
    <div className="panel gesture-panel">
      <h2>Gesture Control</h2>

      <p className="gesture-status">
        <strong>Status:</strong> {status}
      </p>

      <p className="gesture-last">
        <strong>Last gesture:</strong> {lastGesture}
      </p>

      <p className="gesture-instructions">
        <strong>How to use:</strong>
        <br />
        • Show <strong>✋ Palm</strong> to freeze mode + highlights
        <br />
        • Show <strong>👍 Thumbs up</strong> to continue live updates
      </p>
    </div>
  );
}
