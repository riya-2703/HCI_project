import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const PORT = process.env.PORT || 5001;

const STOPWORDS = new Set([
  "the","a","an","and","or","of","to","in","on","for","is","are","was","were","be",
  "this","that","with","by","as","at","it","from","we","our","their","they","you"
]);

function tokenize(str) {
  return str
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function sentenceOverlapScores(sentences, summaryText) {
  const summaryTokens = new Set(tokenize(summaryText));
  if (summaryTokens.size === 0) {
    return sentences.map(() => 0.0);
  }

  return sentences.map((s) => {
    const stoks = tokenize(s);
    if (stoks.length === 0) return 0.0;
    let overlap = 0;
    stoks.forEach((t) => {
      if (summaryTokens.has(t)) overlap += 1;
    });
    return overlap / stoks.length; 
  });
}

app.post("/api/summarize", async (req, res) => {
  try {
    const { text, sentences } = req.body;
    if (!text || !Array.isArray(sentences)) {
      return res.status(400).json({ error: "text and sentences[] required" });
    }

    let summary = "";
    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ inputs: text })
        }
      );

      if (!response.ok) {
        console.error("HF API error", await response.text());
        throw new Error("HF API failed");
      }

      const result = await response.json();
      if (Array.isArray(result) && result[0]?.summary_text) {
        summary = result[0].summary_text;
      } else {
        summary = text.slice(0, 500);
      }
    } catch (err) {
      console.error("Error calling HF:", err.message);
      summary = text.slice(0, 500);
    }

    const scores = sentenceOverlapScores(sentences, summary);

    return res.json({
      summary,
      scores
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
