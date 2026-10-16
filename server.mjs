import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3028;

// Carica variabili d'ambiente da file .env locale (Zero librerie esterne)
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const PROVIDERS = {
  gemini: {
    name: 'Gemini (Google)',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  groq: {
    name: 'Groq (Llama 3.3 70B)',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
  },
  agnes: {
    name: 'Agnes AI',
    baseUrl: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
    apiKey: process.env.AGNES_API_KEY,
    model: 'agnes-3.0-flash',
  }
};

async function callProvider(providerKey, systemPrompt, userPrompt, temperature = 0.3) {
  const p = PROVIDERS[providerKey];
  if (!p || !p.apiKey) {
    throw new Error(`Chiave API per ${p?.name || providerKey} mancante. Inseriscila nel tuo file .env`);
  }

  const endpoint = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.apiKey}`
      },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`[${p.name}] HTTP ${res.status}: ${errTxt.slice(0, 300)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Nessuna risposta generata.';
  } catch (err) {
    clearTimeout(timeoutId);
    if (providerKey === 'gemini') {
      console.warn(`⚠️ [Fallback] Gemini non disponibile, delega a Groq...`, err.message);
      return await callProvider('groq', systemPrompt, userPrompt, temperature);
    }
    throw err;
  }
}

// Risolve ed estrae contesto da link web, TikTok e YouTube
async function resolveUrlContent(rawText) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = rawText.match(urlRegex);
  if (!urls || urls.length === 0) return rawText;

  let enrichedContext = rawText;

  for (const u of urls.slice(0, 2)) {
    try {
      if (u.includes('tiktok.com')) {
        let cleanUrl = u;
        if (u.includes('vm.tiktok.com')) {
          const headRes = await fetch(u, { method: 'HEAD', redirect: 'follow' });
          cleanUrl = headRes.url || u;
        }
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        const oRes = await fetch(oembedUrl);
        if (oRes.ok) {
          const oJson = await oRes.json();
          enrichedContext += `\n\n[DATI ESTRATTI DAL LINK TIKTOK (${u})]:\nTitolo / Caption: "${oJson.title || 'N/A'}"\nAutore: ${oJson.author_name || 'N/A'} (@${oJson.author_unique_id || ''})\nTipo: ${oJson.type}`;
        }
      } else if (u.includes('youtube.com') || u.includes('youtu.be')) {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`;
        const oRes = await fetch(oembedUrl);
        if (oRes.ok) {
          const oJson = await oRes.json();
          enrichedContext += `\n\n[DATI ESTRATTI DAL LINK YOUTUBE (${u})]:\nTitolo Video: "${oJson.title || 'N/A'}"\nCanale: ${oJson.author_name || 'N/A'}`;
        }
      } else {
        const pageRes = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          redirect: 'follow',
          signal: AbortSignal.timeout(5000)
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                                html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
          const title = titleMatch ? titleMatch[1].trim() : '';
          const desc = metaDescMatch ? metaDescMatch[1].trim() : '';
          if (title || desc) {
            enrichedContext += `\n\n[CONTENUTO ESTRATTO DALLA PAGINA WEB (${u})]:\nTitolo: ${title}\nDescrizione: ${desc}`;
          }
        }
      }
    } catch (e) {
      console.warn(`[UrlResolver] Errore risoluzione ${u}:`, e.message);
    }
  }

  return enrichedContext;
}

const AGENT_PERSONAS = {
  champion: {
    provider: 'gemini',
    title: 'Il Sostenitore Visionario',
    badge: 'Product Champion & Scale',
    system: `Sei il SOSTENITORE VISIONARIO (Product Champion) in un comitato di stress-test per startup, business model e accordi commerciali.
Il tuo obiettivo è difendere l'idea ed esplorarne il massimo potenziale:
1. Posizionamento e proposta di valore unica (UVP) per dominare il mercato.
2. Perché i clienti o partner pagheranno con entusiasmo.
3. Come creare un vantaggio competitivo ("fossato difensivo") grazie all'AI e alle automazioni.
4. Come scalare l'offerta a costi marginali minimi.
Rispondi in italiano con bullet point incisivi e densi.`
  },
  skeptic: {
    provider: 'deepseek',
    title: 'Lo Scettico Spietato',
    badge: 'Red Teamer & Devil\'s Advocate',
    system: `Sei lo SCETTICO SPIETATO (Red Teamer & Devil's Advocate) in un comitato di stress-test.
Il tuo compito NON è essere accomodante, ma individuare ogni falla prima che vengano sprecati tempo e denaro:
1. Perché quest'idea rischia di fallire miseramente nei primi 60 giorni.
2. Rischi di piattaforma, dipendenze da terzi (API, policy, scraping) o barriere all'entrata basse.
3. Frizioni reali di vendita e onboarding.
4. Chi può copiare o distruggere questo business a metà prezzo.
Sii implacabile, analitico e chirurgico.`
  },
  cfo: {
    provider: 'groq',
    title: 'Il CFO Spietato',
    badge: 'Unit Economics & Cash Flow',
    system: `Sei il CFO SPIETATO (Unit Economics Shark) nel comitato di stress-test.
Ti interessano SOLO numeri, margini e cassa:
1. Modello di Pricing ideale (Setup, MRR ricorrente o Revenue Share).
2. Costi vivi di erogazione (token LLM, hosting/VPS, database, ore/uomo).
3. Unit Economics e margine lordo target (> 75%).
4. Struttura contrattuale per incassare subito cassa ed evitare di lavorare gratis per partner opportunisti.
Sii schematico, pragmatico e diretto.`
  },
  judge: {
    provider: 'agnes',
    title: 'Il Giudice Esecutivo',
    badge: 'Chairman & Final Arbiter',
    system: `Sei il GIUDICE ESECUTIVO (Chairman & Final Arbiter) del comitato di stress-test.
Hai ascoltato attentamente il Sostenitore (Gemini), lo Scettico (DeepSeek) e il CFO (Groq).
Emetti la DECISION CARD definitiva:
- VERDETTO: [APPROVE (Costruisci subito) | CONDITIONAL (Costruisci SOLO se rispetti le condizioni) | KILL (Scarta o ridimensiona)]
- FEASIBILITY SCORE: [Punteggio da 0 a 100]
- FATAL FLAW #1 (Il rischio killer da risolvere prima di toccare una riga di codice)
- LA FORMULA CONTRATTUALE O DI PRICING RACCOMANDATA
- LA PRIMA MOSSA A COSTO ZERO DA FARE NELLE PROSSIME 24 ORE
Sii autorevole, sintetico e definitivo.`
  }
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/board')) {
    const htmlPath = path.resolve(__dirname, 'public/index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      port: PORT,
      providers: {
        gemini: Boolean(PROVIDERS.gemini.apiKey),
        deepseek: Boolean(PROVIDERS.deepseek.apiKey),
        groq: Boolean(PROVIDERS.groq.apiKey),
        agnes: Boolean(PROVIDERS.agnes.apiKey),
      }
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/evaluate-agent') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { role, idea, boardContext } = payload;
        const persona = AGENT_PERSONAS[role];

        if (!persona) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ruolo sconosciuto: ${role}` }));
          return;
        }

        const enrichedIdea = await resolveUrlContent(idea);

        let prompt = `IDEA DI BUSINESS / PROGETTO / LINK DA VALUTARE:\n"""\n${enrichedIdea}\n"""\n`;
        if (role === 'judge' && boardContext) {
          prompt += `\nDIBATTITO PRECEDENTE DEL COMITATO:\n`;
          prompt += `--- ARGOMENTI DEL SOSTENITORE (Gemini) ---\n${boardContext.champion || 'N/A'}\n\n`;
          prompt += `--- CRITICHE DELLO SCETTICO (DeepSeek) ---\n${boardContext.skeptic || 'N/A'}\n\n`;
          prompt += `--- ANALISI FINANZIARIA DEL CFO (Groq) ---\n${boardContext.cfo || 'N/A'}\n\n`;
          prompt += `Ora emetti il verdetto finale esecutivo, score numerico e prima mossa.`;
        }

        const reply = await callProvider(persona.provider, persona.system, prompt);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          role,
          provider: persona.provider,
          title: persona.title,
          content: reply
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint non trovato' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🏛️  ADVERSARIAL AI BOARD SERVER ATTIVO`);
  console.log(`📍  URL:   http://localhost:${PORT}`);
  console.log(`🧠  4 Cervelli: Gemini + DeepSeek + Groq + Agnes`);
  console.log(`======================================================\n`);
});
