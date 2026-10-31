# AI Search Readiness (GEO & AEO): https://www.astrojak.in/

**Score: 74 / 100**  
**Category Weight: 10%**

---

## 1. AI Crawler Accessibility (User-Agent Matrix)

Simulated HTTP probe against top AI engine user agents:

| Crawler | Purpose | Status | Challenge / Block | Result |
|---------|---------|--------|-------------------|--------|
| **GPTBot** | OpenAI Training / Retrieval | 200 OK | None | Full HTML Accessible |
| **OAI-SearchBot** | ChatGPT Search Indexing | 200 OK | None | Full HTML Accessible |
| **ChatGPT-User** | ChatGPT Live Browsing | 200 OK | None | Full HTML Accessible |
| **ClaudeBot** | Anthropic Training / Retrieval | 200 OK | None | Full HTML Accessible |
| **Claude-SearchBot** | Claude Search Indexing | 200 OK | None | Full HTML Accessible |
| **Claude-User** | Claude Live Fetch | 200 OK | None | Full HTML Accessible |
| **PerplexityBot** | Perplexity AI Indexing | 200 OK | None | Full HTML Accessible |
| **Perplexity-User** | Perplexity Live Answers | 200 OK | None | Full HTML Accessible |

**Findings**: Cloudflare WAF does not challenge or drop AI agents. Primary textual content is 100% visible without JavaScript execution.

---

## 2. Agent Discovery & Information Extraction

- **/llms.txt & /llms-full.txt**: **HTTP 404 (Missing)**
  - Publishing an `/llms.txt` file is the industry standard for Generative Engine Optimization (GEO). It allows AI models to parse site capability, services, pricing, and FAQ summaries directly.
- **Content-Signal Policy**: **Missing**
  - No `Content-Signal` header or robots.txt line is present to govern AI training versus search usage.
- **Passage Citability**:
  - The FAQ and pricing sections have high factual clarity and direct answers (e.g., "What if I don't know my birth time?", "Which plan is right for me?"), which make them highly citable by Google AI Overviews and ChatGPT Search.

---

## 3. Recommended `llms.txt` Template

Create `D:\Astrojak\astrojak\llms.txt`:

```markdown
# ASTROJAK - Vedic Astrology Consultation

> 1:1 online Vedic astrology consultation platform led by Acharya Narender Ji. Kundali Analysis, Marriage Matchmaking, and Vedic remedies over call and WhatsApp.

## Services & Plans
- **Reserve Your Slot (Introductory)**: ₹101 (10-min consultation + personal horoscope PDF report)
- **Kundali Analysis**: ₹999 (Comprehensive birth chart reading)
- **Detailed Kundali Analysis**: ₹1499 (Dasha timing, transits, and customized Vedic remedies)
- **Marriage Matchmaking (Kundli Milan)**: ₹1499 (36 Guna Milan, Manglik Dosh analysis)

## Astrologer
- **Acharya Narender Ji**: 20+ years experience, 1000+ consultations, 4.98 rating. Specializing in Janam Kundali analysis, marriage compatibility, and Vedic remedies.

## Contact & Links
- Website: https://www.astrojak.in/
- WhatsApp: +91 78276 73637
- Email: support@astrojak.in
```
