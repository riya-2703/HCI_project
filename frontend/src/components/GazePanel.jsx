import React, { useEffect, useRef, useState } from "react";

const SAMPLE_INTERVAL_MS = 100;
const HISTORY_LEN = 6;
const MODE_THRESHOLD = 0.4;
const MIN_SWITCH_INTERVAL_MS = 500;
const AUTO_SCROLL_ENABLED = true;
const EDGE_PX = 120;
const MAX_SCROLL_PX_PER_TICK = 34;

export default function GazePanel({
  active,
  frozen = false,
  sentenceRects,
  onGazeModeChange,
  onGazeMetricsUpdate,
}) {
  const [statusMsg, setStatusMsg] = useState(
    "When Smart Skimming is active, the webcam is used to approximate gaze."
  );
  const [lastSample, setLastSample] = useState(null);

  const sentenceRectsRef = useRef([]);
  const modeCbRef = useRef(onGazeModeChange);
  const metricsCbRef = useRef(onGazeMetricsUpdate);

  const prevPointRef = useRef(null);
  const historyRef = useRef([]);
  const currentModeRef = useRef("idle");
  const lastSwitchTimeRef = useRef(0);

  const statsRef = useRef({ gazeSamples: 0, backwardJumps: 0 });

  const streamRef = useRef(null);

  useEffect(() => {
    sentenceRectsRef.current = sentenceRects || [];
  }, [sentenceRects]);

  useEffect(() => {
    modeCbRef.current = onGazeModeChange;
  }, [onGazeModeChange]);

  useEffect(() => {
    metricsCbRef.current = onGazeMetricsUpdate;
  }, [onGazeMetricsUpdate]);

  function getLineIndexForPoint(x, y) {
    const rects = sentenceRectsRef.current;
    if (!rects?.length) return null;

    let bestIdx = null;
    let bestDist = Infinity;

    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (!r) continue;
      const centerY = r.top + r.height / 2;
      const dy = Math.abs(y - centerY);
      if (dy < bestDist) {
        bestDist = dy;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function maybeAutoScroll(gazeY) {
    if (!AUTO_SCROLL_ENABLED || !active || frozen || gazeY == null) return;

    const ae = document.activeElement;
    if (ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT")) return;

    const scroller = document.scrollingElement || document.documentElement;
    const vh = window.innerHeight;

    const topEdge = EDGE_PX;
    const bottomEdge = vh - EDGE_PX * 2;

    let delta = 0;

    if (gazeY < topEdge) {
      delta = -Math.max(1, ((topEdge - gazeY) / topEdge) * MAX_SCROLL_PX_PER_TICK);
    } else if (gazeY > bottomEdge) {
      delta = Math.max(
        1, ((gazeY - bottomEdge) / Math.max(1, vh - bottomEdge)) * MAX_SCROLL_PX_PER_TICK
      );
    }

    if (delta) scroller.scrollTop += delta;
  }

  function handleGazePoint(x, y, tMs) {
    statsRef.current.gazeSamples += 1;

    const lineIdx = getLineIndexForPoint(x, y);
    const prev = prevPointRef.current;

    if (prev?.lineIdx != null && lineIdx != null && lineIdx < prev.lineIdx) {
      statsRef.current.backwardJumps += 1;
    }

    metricsCbRef.current?.({ ...statsRef.current });

    if (!prev) {
      prevPointRef.current = { x, y, tMs, lineIdx };
      return;
    }

    const dtSec = Math.max((tMs - prev.tMs) / 1000, 0.001);
    const dy = y - prev.y;
    const dist = Math.hypot(x - prev.x, dy);

    let rawMode = "reading";
    if ((lineIdx - prev.lineIdx >= 1 || dy > 40) && dtSec < 1.5) rawMode = "skimming";
    else if ((lineIdx - prev.lineIdx <= -1 || dy < -40) && dtSec < 1.5)
      rawMode = "rereading";
    else if (dist < 10 && dtSec > 1.0) rawMode = "idle";

    historyRef.current.push(rawMode);
    if (historyRef.current.length > HISTORY_LEN) historyRef.current.shift();

    const counts = { idle: 0, reading: 0, skimming: 0, rereading: 0 };
    historyRef.current.forEach((m) => counts[m]++);

    const bestMode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const frac = counts[bestMode] / historyRef.current.length;

    if (!frozen) {
      const now = tMs;
      if (
        bestMode !== currentModeRef.current &&
        frac >= MODE_THRESHOLD &&
        now - lastSwitchTimeRef.current >= MIN_SWITCH_INTERVAL_MS
      ) {
        currentModeRef.current = bestMode;
        lastSwitchTimeRef.current = now;
        modeCbRef.current?.(bestMode);
      }
    }

    prevPointRef.current = { x, y, tMs, lineIdx };
  }

  useEffect(() => {
    let cancelled = false;
    let pollId = null;

    async function startWebgazer() {
      if (!window.webgazer) return;

      setStatusMsg("Starting WebGazer… please allow camera access.");

      window.webgazer.showVideo(false);
      window.webgazer.showFaceOverlay(false);
      window.webgazer.showFaceFeedbackBox(false);

      await window.webgazer.begin();

      const ids = [
        "webgazerVideoFeed",
        "webgazerVideoCanvas",
        "webgazerFaceOverlay",
        "webgazerFaceFeedbackBox",
      ];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });

      let container = document.getElementById("webgazerVideoContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "webgazerVideoContainer";
        document.body.appendChild(container);
      }

      let preview = document.getElementById("smartPreviewVideo");
      if (!preview) {
        preview = document.createElement("video");
        preview.id = "smartPreviewVideo";
        preview.autoplay = true;
        preview.muted = true;
        preview.playsInline = true;
        preview.style.width = "100%";
        preview.style.height = "100%";
        preview.style.objectFit = "cover";
        preview.style.transform = "scaleX(-1)";
        container.appendChild(preview);
      }

      const wgVideo = document.getElementById("webgazerVideoFeed");
      if (wgVideo?.srcObject && !streamRef.current) {
        streamRef.current = wgVideo.srcObject;
        preview.srcObject = streamRef.current;
        preview.play?.().catch(() => {});
      }

      setStatusMsg("WebGazer running.");

      pollId = setInterval(async () => {
        if (cancelled) return;
        const data = await window.webgazer.getCurrentPrediction();
        if (!data) return;

        const now = performance.now();
        setLastSample({ x: data.x, y: data.y, t: now });

        maybeAutoScroll(data.y);
        handleGazePoint(data.x, data.y, now);
      }, SAMPLE_INTERVAL_MS);
    }

    async function stopWebgazer() {
      if (pollId) clearInterval(pollId);
      pollId = null;
    }

    if (active) startWebgazer();
    else stopWebgazer();

    return () => {
      cancelled = true;
      stopWebgazer();
    };
  }, [active]); 

  return (
    <div className="panel gaze-panel">
      <h2>Gaze Tracker</h2>
      <p>
        <strong>Status:</strong> {statusMsg}
      </p>
      {lastSample && (
        <p>
          Last gaze sample: x={Math.round(lastSample.x)}, y={Math.round(lastSample.y)}
        </p>
      )}
    </div>
  );
}
