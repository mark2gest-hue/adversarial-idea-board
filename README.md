# 🏛️ Adversarial AI Advisory Board

> **Stress-test business ideas, pitches, contracts and TikTok/YouTube business models with 4 divergent AI minds before writing a single line of code.**

---

## 🧠 The 4 Independent AI Personas

Most multi-agent tools fail because they run on the same LLM (creating an echo chamber). This board orchestrates **4 completely different AI models with opposing objectives**:

| Role | Model Engine | Persona & Objective |
| :--- | :--- | :--- |
| 🟢 **The Product Champion** | **Google Gemini (Flash/Pro)** | Explores maximum market upside, viral positioning, product moat, and zero-marginal-cost scaling. |
| 🔴 **The Ruthless Skeptic** | **DeepSeek (Reasoner / V3)** | The Red Teamer. Aggressively finds why the idea will fail in 60 days, platform risks, and onboarding friction. |
| 🟡 **The Shark CFO** | **Groq (Llama 3.3 70B)** | Cold unit economics: pricing strategy (MRR vs Setup), token/hosting costs, net margins, and upfront cash flow terms. |
| ⚖️ **The Executive Judge** | **Agnes AI (or OpenAI compatible)** | Impartial arbiter. Synthesizes the debate, outputs **Feasibility Score (0-100)**, **Fatal Flaw #1**, and **First Zero-Cost Action in 24h**. |

---

## ⚡ Features
- **Zero NPM Dependencies**: Runs on native Node.js 18+ (`fetch`, standard HTTP server).
- **Automatic Link Resolution**: Paste TikTok videos, YouTube links, or landing pages; the board extracts captions/metadata automatically.
- **Pure Privacy**: Your API keys stay in your local `.env`. Nothing is sent to third-party databases.
- **Obsidian Second Brain Integration**: 1-click export to Markdown for your personal knowledge base.

---

## 🚀 Quick Start (In 60 seconds)

### 1. Clone the repository
```bash
git clone https://github.com/mark2gest-hue/adversarial-idea-board.git
cd adversarial-idea-board
```

### 2. Configure your API Keys
Copy the example `.env` file:
```bash
cp .env.example .env
```
Open `.env` and insert your personal API keys (you can start with free tier keys):
```env
GEMINI_API_KEY="your_gemini_key"       # https://aistudio.google.com/
DEEPSEEK_API_KEY="your_deepseek_key"   # https://platform.deepseek.com/
GROQ_API_KEY="your_groq_key"           # https://console.groq.com/
AGNES_API_KEY="your_agnes_or_ai_key"   # https://apihub.agnes-ai.com/
```

### 3. Start the Board
```bash
npm start
```
Open **[http://localhost:3028](http://localhost:3028)** in your browser.

---

## 🛠️ Tech Stack
- **Backend**: Native Node.js ESM (`server.mjs`)
- **Frontend**: Single-file reactive dashboard (HTML5, Tailwind CSS via CDN, Google Fonts)
- **APIs**: Standard OpenAI-compatible Chat Completions endpoints + OpenGraph / OEmbed resolvers

---

## 📄 License
MIT License. Created by [Marco](https://github.com/mark2gest-hue).
