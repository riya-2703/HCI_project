# Smart Skimming: Gaze-Aware Reading Interface

Smart Skimming is a gaze-aware reading system that adapts digital text interfaces based on real-time user reading behavior. Using webcam-based gaze tracking, the system identifies reading patterns such as normal reading, skimming, re-reading and freeze states and dynamically updates the UI and metrics panel.

This project was developed as part of a **Human–Computer Interaction (HCI)** course.

---

## Features
- Webcam-based gaze tracking
- Real-time detection of reading behaviors
- Adaptive UI feedback
- Live reading metrics (time spent, gaze samples, backward jumps)
- Modular React-based frontend
- Lightweight Node.js backend

---

## Tech Stack
**Frontend**
- React (Vite)
- JavaScript
- WebGazer.js
- HTML/CSS

**Backend**
- Node.js
- Express

---

## Project Structure
smart_skimming/
├── backend/ # Node.js server
├── frontend/ # React frontend
└── README.md


---

## Setup Instructions

### Prerequisites
- Node.js (v18 or later)
- Webcam-enabled laptop
- Google Chrome (recommended)

---

### Backend Setup
```bash
cd backend
npm install
node server.js
```

### Frontend Setup
cd frontend
npm install
npm run dev

### Open browser at 
http://localhost:5173


### Usage
```bash

Start backend and frontend servers

Open the app in the browser

Begin reading the displayed text

Observe real-time gaze mode changes and live metrics

Explore skimming, freeze, and re-reading behaviors
```

### Author
Riya Nadagire
MS Computer Science, Stony Brook University