import React from "react";

export default function MetricsPanel({
  gazeMode = "idle",
  metrics = {},
  timeReadingMs = 0,
  timeSkimmingMs = 0,
  timeRereadingMs = 0,
}) {
  const gazeSamples = metrics?.gazeSamples ?? 0;
  const backwardJumps = metrics?.backwardJumps ?? 0;

  const readingSec = timeReadingMs / 1000;
  const skimmingSec = timeSkimmingMs / 1000;
  const rereadingSec = timeRereadingMs / 1000;
  const totalSec = readingSec + skimmingSec + rereadingSec;

  return (
    <div className="panel">
      <h2>Live Metrics</h2>
      <p>
        <strong>Current gaze mode:</strong> {String(gazeMode).toUpperCase()}
      </p>

      <ul className="metrics-list">
        <li>Total time: {totalSec.toFixed(1)} s</li>
        <li>Reading time: {readingSec.toFixed(1)} s</li>
        <li>Skimming time: {skimmingSec.toFixed(1)} s</li>
        <li>Re-reading time: {rereadingSec.toFixed(1)} s</li>
        <li>Gaze samples: {gazeSamples}</li>
        <li>Backward jumps: {backwardJumps}</li>
      </ul>
    </div>
  );
}
