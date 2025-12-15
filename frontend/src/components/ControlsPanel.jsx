import React from "react";

export default function ControlsPanel({ mode, setMode }) {
  return (
    <div className="panel controls-panel">
      <h2>Conditions</h2>
      <div className="mode-buttons">
        <button
          className={mode === "baseline" ? "active" : ""}
          onClick={() => setMode("baseline")}
        >
          Baseline
        </button>
        <button
          className={mode === "smart" ? "active" : ""}
          onClick={() => setMode("smart")}
        >
          Smart Skimming
        </button>
      </div>
      <p className="hint-text">
        Baseline: static text.<br></br> Smart Skimming: gaze-driven highlighting when you skim.
      </p>
    </div>
  );
}
