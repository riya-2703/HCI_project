import React, { useEffect, useState, useRef, useCallback } from "react";
import "./styles/app.css";

import ControlsPanel from "./components/ControlsPanel.jsx";
import Reader from "./components/Reader.jsx";
import GazePanel from "./components/GazePanel.jsx";
import MetricsPanel from "./components/MetricsPanel.jsx";
import ExportPanel from "./components/ExportPanel.jsx";
import GestureControl from "./components/GestureControl.jsx";
import { logEvent, clearEvents } from "./logging/eventLogger";

const SAMPLE_TEXT = `
Human–computer interaction (HCI) is the study of how people interact with digital systems and how those systems can be designed to better support human needs. As computing has become deeply embedded in everyday life, understanding the relationship between humans and technology has become increasingly important. HCI draws from computer science, psychology, design, ergonomics, and social sciences to create interfaces that are usable, efficient, and intuitive.

Early computer systems were primarily built for trained experts. Users were required to memorize complex commands and interact through text-based interfaces. This created a steep learning curve and limited accessibility. The introduction of graphical user interfaces marked a turning point by allowing users to interact through visual elements such as icons, windows, and menus. These interfaces reduced cognitive load and enabled a broader population to use computers effectively.

As technology evolved, interaction techniques expanded beyond keyboards and mice. Touchscreens allowed direct manipulation of content, while voice interfaces enabled hands-free interaction. More recently, eye tracking and gesture-based interaction have emerged as promising modalities. These approaches aim to make interaction more natural by aligning system behavior with human perceptual and motor abilities.

Despite these advances, reading long digital content remains cognitively demanding. Users often face large volumes of text in the form of research papers, documentation, legal material, and online articles. Due to time pressure, readers frequently skim instead of reading every word. Skimming involves rapid eye movements, short fixations, and skipping lines to extract key information quickly.

Most existing reading interfaces are optimized for linear, word-by-word reading. They do not adapt to skimming behavior and often require users to manually search for important sections. This mismatch between interface design and natural reading behavior can lead to reduced comprehension, increased effort, and frustration.

Gaze-aware systems offer a way to bridge this gap. By estimating where users are looking on the screen, these systems can infer how users are interacting with text. Slow, sequential eye movements typically indicate careful reading, while fast downward jumps suggest skimming. Upward movements may indicate re-reading when users revisit earlier content to confirm understanding.

By combining gaze estimation with natural language processing, interfaces can adapt in real time. When the system detects skimming behavior, it can highlight key sentences that carry the most important information. During careful reading, the interface remains unobtrusive, allowing users to focus without distraction. This adaptive behavior aligns interface responses with user intent.

Such systems have significant potential in educational, professional, and research settings. Students can quickly identify critical points in textbooks and lecture notes. Professionals can scan reports and documentation efficiently under time constraints. Researchers can navigate long papers while still capturing essential contributions.

As interaction techniques continue to evolve, gaze-aware and adaptive interfaces represent a step toward more human-centered computing. By respecting natural reading behavior and reducing unnecessary effort, these systems aim to improve efficiency, comprehension, and overall user satisfaction. The future of reading interfaces lies in systems that understand not just what users read, but how they read.
`;

function splitIntoSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchScoresFromBackend(text) {
  try {
    const resp = await fetch("http://localhost:5000/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.scores ?? null;
  } catch {
    return null;
  }
}

function pickTopSentences(scores, k = 5) {
  if (!scores || scores.length === 0) return [];
  return scores
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map((x) => x.i);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [mode, setMode] = useState("baseline");
  const [text, setText] = useState(SAMPLE_TEXT);

  const [sentences, setSentences] = useState([]);
  const [scores, setScores] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [sentenceRects, setSentenceRects] = useState([]);

  const [gazeMode, setGazeMode] = useState("idle");
  const [isFrozen, setIsFrozen] = useState(false);

  const [metrics, setMetrics] = useState({
    gazeSamples: 0,
    backwardJumps: 0,
  });

  const [timeReadingMs, setTimeReadingMs] = useState(0);
  const [timeSkimmingMs, setTimeSkimmingMs] = useState(0);
  const [timeRereadingMs, setTimeRereadingMs] = useState(0);

  const currentGazeModeRef = useRef("idle");
  const frozenRef = useRef(false);

  const highlightedEverRef = useRef(new Set());

  useEffect(() => {
    frozenRef.current = isFrozen;
  }, [isFrozen]);

  useEffect(() => {
    const s = splitIntoSentences(text);
    setSentences(s);
    setHighlights([]);
    highlightedEverRef.current = new Set();
  }, [text]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const joined = sentences.join(" ");
      const backendScores = await fetchScoresFromBackend(joined);

      if (cancelled) return;

      if (backendScores && backendScores.length === sentences.length) {
        setScores(backendScores);
      } else {
        setScores(sentences.map(() => Math.random()));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sentences]);

  const setHighlightsAndRemember = useCallback((idxs) => {
    const arr = Array.isArray(idxs) ? idxs : [];
    for (const i of arr) highlightedEverRef.current.add(i);
    setHighlights(arr);
  }, []);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    logEvent("uiModeChange", { uiMode: newMode });

    setGazeMode("idle");
    currentGazeModeRef.current = "idle";
    setHighlightsAndRemember([]);

    if (newMode !== "smart") setIsFrozen(false);
  };

  const handleGazeModeChange = useCallback((newMode) => {
    if (newMode === currentGazeModeRef.current) return;
    currentGazeModeRef.current = newMode;

    if (frozenRef.current) return;

    setGazeMode(newMode);
    logEvent("modeChange", { mode: newMode });
  }, []);

  const handleGazeMetricsUpdate = useCallback((partial) => {
    setMetrics((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleFreezeChange = useCallback(
    (frozen, meta = {}) => {
      setIsFrozen(frozen);
      logEvent(frozen ? "freeze" : "unfreeze", {
        source: meta.source || "gesture",
        gesture: meta.gesture,
      });

      if (frozen) {
        setGazeMode("freeze");
        if (mode === "smart") {
          setHighlightsAndRemember(pickTopSentences(scores, 5));
        }
        return;
      }

      setGazeMode(currentGazeModeRef.current);
    },
    [mode, scores, setHighlightsAndRemember]
  );

  useEffect(() => {
    if (mode !== "smart") {
      setHighlightsAndRemember([]);
      return;
    }

    if (isFrozen) return;

    if (gazeMode === "skimming") {
      setHighlightsAndRemember(pickTopSentences(scores, 5));
    } else {
      setHighlightsAndRemember([]);
    }
  }, [mode, gazeMode, scores, isFrozen, setHighlightsAndRemember]);

  useEffect(() => {
    if (mode !== "smart") return;
    if (!isFrozen) return;
    if (!scores || scores.length === 0) return;
    if (highlights && highlights.length > 0) return;

    setHighlightsAndRemember(pickTopSentences(scores, 5));
  }, [mode, isFrozen, scores, highlights, setHighlightsAndRemember]);

  useEffect(() => {
    const interval = setInterval(() => {
      const m = currentGazeModeRef.current;
      if (m === "reading") setTimeReadingMs((t) => t + 200);
      if (m === "skimming") setTimeSkimmingMs((t) => t + 200);
      if (m === "rereading") setTimeRereadingMs((t) => t + 200);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleExportSentences = () => {
    const idxs = Array.from(highlightedEverRef.current)
      .filter((i) => Number.isInteger(i))
      .sort((a, b) => a - b);

    const lines = idxs
      .map((i) => sentences[i])
      .filter(Boolean)
      .map((s, n) => `${n + 1}. ${s}`);

    const payload =
      `Export Sentences (unique highlighted)\n` +
      `Count: ${lines.length}\n\n` +
      (lines.length ? lines.join("\n\n") : "No highlighted sentences yet.");

    downloadTextFile("highlighted_sentences.txt", payload);
  };

  const handleExportLogs = () => {
    const readingSec = (timeReadingMs / 1000).toFixed(1);
    const skimmingSec = (timeSkimmingMs / 1000).toFixed(1);
    const rereadingSec = (timeRereadingMs / 1000).toFixed(1);
    const totalSec = (
      timeReadingMs / 1000 +
      timeSkimmingMs / 1000 +
      timeRereadingMs / 1000
    ).toFixed(1);

    const payload =
      `Export Logs (Right Panel)\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `Current gaze mode: ${String(gazeMode)}\n` +
      `Gaze samples: ${metrics.gazeSamples ?? 0}\n` +
      `Backward jumps: ${metrics.backwardJumps ?? 0}\n\n` +
      `Time reading (s): ${readingSec}\n` +
      `Time skimming (s): ${skimmingSec}\n` +
      `Time rereading (s): ${rereadingSec}\n` +
      `Total time (s): ${totalSec}\n`;

    downloadTextFile("right_panel_logs.txt", payload);
  };

  const handleClearLogs = () => {
    clearEvents();

    setMetrics({ gazeSamples: 0, backwardJumps: 0 });
    setTimeReadingMs(0);
    setTimeSkimmingMs(0);
    setTimeRereadingMs(0);

    setHighlights([]);
    highlightedEverRef.current = new Set();

    setIsFrozen(false);
    setGazeMode("idle");
    currentGazeModeRef.current = "idle";

    logEvent("logsCleared", {});
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Smart Skimming</h1>
        <div className="subtitle">
          Webcam-based gaze approximation to detect skimming vs reading. Highlights important sentences during skimming.
        </div>
      </header>

      <main className="app-main">
        <section className="left-pane">
          <ControlsPanel mode={mode} setMode={handleModeChange} />

          {mode === "smart" && (
            <GestureControl
              active={true}
              onFreezeChange={handleFreezeChange}
              showPreview={false}
            />
          )}

          <GazePanel
            active={mode === "smart"}
            frozen={isFrozen}
            sentenceRects={sentenceRects}
            onGazeModeChange={handleGazeModeChange}
            onGazeMetricsUpdate={handleGazeMetricsUpdate}
          />
        </section>

        <section className="center-pane">
          <Reader
            mode={mode}
            sentences={sentences}
            scores={scores}
            highlights={highlights}
            onRectsChange={setSentenceRects}
          />
        </section>

        <section className="right-pane">
          <MetricsPanel
            gazeMode={gazeMode}
            metrics={metrics}
            timeReadingMs={timeReadingMs}
            timeSkimmingMs={timeSkimmingMs}
            timeRereadingMs={timeRereadingMs}
          />

          <ExportPanel
            onExportSentences={handleExportSentences}
            onExportLogs={handleExportLogs}
            onClearLogs={handleClearLogs}
          />
        </section>
      </main>

      <div id="webgazerVideoContainer" />
    </div>
  );
}
