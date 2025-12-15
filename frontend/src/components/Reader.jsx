import React, { useEffect } from "react";
import "../styles/reader.css";

export default function Reader({
  mode,
  sentences,
  scores,
  highlights,
  onRectsChange,
  summaryText
}) {
  useEffect(() => {
    const spans = Array.from(document.querySelectorAll(".reader-sentence"));
    const rects = spans.map((el, idx) => {
      const r = el.getBoundingClientRect();
      return {
        idx,
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
        left: r.left + window.scrollX,
        right: r.right + window.scrollX
      };
    });
    onRectsChange(rects);
  }, [sentences, highlights]); 

  return (
    <div className="reader-container">
      <div className="reader-header">
        <h2>{mode === "baseline" ? "Baseline Reader" : "Smart Skimming Reader"}</h2>
        <p>
          Scroll and read normally. When the system detects skimming in Smart mode,
          it will highlight important sentences.
        </p>
      </div>
      <div className="reader-text">
        {sentences.map((s, idx) => {
          const isHighlighted = highlights.includes(idx);
          const score = scores[idx] ?? 0;
          return (
            <span
              key={idx}
              className={
                "reader-sentence " +
                (isHighlighted && mode === "smart" ? "highlighted-sentence" : "")
              }
              data-score={score.toFixed(2)}
            >
              {s.trim()}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
}
