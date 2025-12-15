function heuristicScoreSentences(sentences) {
  const n = sentences.length;
  return sentences.map((s, idx) => {
    const words = s.split(/\s+/);
    const len = words.length;
    const hasNumber = /\d/.test(s) ? 1 : 0;
    const positionBonus = idx === 0 || idx === n - 1 ? 0.5 : 0;
    const lenScore = Math.min(len / 20, 1.0);
    return lenScore * 0.6 + hasNumber * 0.3 + positionBonus * 0.1;
  });
}

export async function getSentenceScores(sentences) {
  const text = sentences.join(" ");
  try {
    const res = await fetch("http://localhost:5001/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sentences })
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (Array.isArray(data.scores) && data.scores.length === sentences.length) {
      return { scores: data.scores, summary: data.summary || "" };
    }
    return {
      scores: heuristicScoreSentences(sentences),
      summary: data.summary || ""
    };
  } catch (err) {
    console.warn("Summarization API failed, using heuristic", err);
    return {
      scores: heuristicScoreSentences(sentences),
      summary: ""
    };
  }
}
