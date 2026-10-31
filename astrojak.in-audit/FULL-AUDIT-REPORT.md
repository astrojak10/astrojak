# Comprehensive SEO Audit Report: https://www.astrojak.in/

**Audit Date**: October 31, 2026  
**Auditor**: Claude SEO (v2.5.0) Engine  
**Target Domain**: [https://www.astrojak.in/](https://www.astrojak.in/)  
**Business Category**: Vedic Astrology & Spiritual Advisory Services (Direct-to-Consumer / Online Professional Service)

---

## Executive Summary

| Category | Score | Weight | Weighted Score | Grade | Status |
|---|---|---|---|---|---|
| **Technical SEO** | 82 / 100 | 22% | 18.04 | B | Solid foundation, missing security headers |
| **Content Quality & E-E-A-T** | 88 / 100 | 23% | 20.24 | A- | High density, expert attribution, needs blog cluster |
| **On-Page SEO** | 78 / 100 | 20% | 15.60 | C+ | Multiple H1 tags on `/home`, inverted breadcrumb |
| **Schema & Structured Data** | 84 / 100 | 10% | 8.40 | B | Comprehensive JSON-LD, missing AggregateRating |
| **Performance (CWV)** | 80 / 100 | 10% | 8.00 | B | Pure static HTML, fast inline CSS, needs LCP priority |
| **AI Search Readiness (GEO)** | 74 / 100 | 10% | 7.40 | C+ | 100% crawl pass, missing `/llms.txt` |
| **Images & Layout** | 82 / 100 | 5% | 4.10 | B | Responsive, CTA pushed below fold on mobile |
| **Overall SEO Health Score** | **82 / 100** | **100%** | **81.78** | **B+** | **Strong foundation; high upside from quick fixes** |

---

## Key Highlights & Top Findings

### Top 5 Strengths
1. **Zero Client-Side Rendering Bottlenecks**: The site serves 100% server-rendered static HTML via Cloudflare Edge CDN. AI search crawlers and Googlebot receive immediate, complete text without JavaScript execution or hydration delay.
2. **First-Person E-E-A-T Authority**: Credentials for **Acharya Narender Ji** (20+ years of experience, 1000+ consultations, 4.98 rating) are clearly articulated alongside authentic testimonial screenshots.
3. **Transparent Pricing Architecture**: Eliminates the high bounce rates common on astrology sites by offering an upfront ₹101 entry point and clear fixed-rate tiers with no per-minute billing pressure.
4. **Clean Canonical & Redirection Matrix**: Non-www and legacy Netlify subdomains properly 301-redirect to `https://www.astrojak.in/`.
5. **Robust Schema Foundations**: Implements structured JSON-LD covering `WebSite`, `ProfessionalService`, `OfferCatalog`, and a 7-item `FAQPage`.

### Top 5 Critical & High-Priority Issues
1. **Multiple H1 Tags on `/home` (Critical)**: `home.html` contains four `<h1>` tags (Hero title + Refund Policy + Privacy Policy + Terms of Service), confusing search engines on primary topical focus.
2. **Missing AggregateRating Schema (High)**: Despite displaying "4.98 rating · 1000+ consultations", no Schema.org `AggregateRating` is implemented, forfeiting valuable star snippets in Google SERPs.
3. **LCP Hero Image Not Priority-Loaded (Medium)**: Hero portrait `/pandit.webp` lacks `fetchpriority="high"` and `<link rel="preload">`, delaying the Largest Contentful Paint metric.
4. **Missing AI Discovery Document (`/llms.txt`) (Medium)**: AI engines (Perplexity, ChatGPT Search, Claude, Gemini) cannot discover the site's structured overview file.
5. **Missing Cloudflare Security Headers (Medium)**: Lacks HSTS (`Strict-Transport-Security`), CSP, and `X-Content-Type-Options: nosniff`.

---

## Detailed Section Analysis

### 1. Technical SEO & Architecture
- **Robots.txt**: Valid at `https://www.astrojak.in/robots.txt`. Correctly disallows `/thank-you` conversion URLs.
- **Sitemap**: Valid `sitemap.xml` with `<loc>`, `<lastmod>`, `<changefreq>`, and `<priority>`.
- **Hosting & Infrastructure**: Hosted on Cloudflare Pages. Delivers rapid TTFB (Time to First Byte) globally via edge caching.
- **Redirects**: Permanent 301 rules redirect `astrojak.in` -> `www.astrojak.in`, `/book` -> `/`, and legacy Netlify URLs -> custom domain.

### 2. Content Quality & E-E-A-T
- **Content Density**: Analyzed via NLP algorithms; scored 0.86–1.0 with 0 filler patterns and 0 AI-generated boilerplate clichés.
- **YMYL (Your Money Your Life) Considerations**: Astrology falls into a sensitive advisory bracket. The site builds trust through:
  - Transparent pricing (₹101 / ₹999 / ₹1499).
  - Explicit refund and privacy policies.
  - Direct WhatsApp and telephone support numbers (+91 78276 73637).
- **Expansion Opportunity**: The site currently targets only bottom-of-funnel conversion keywords. Building out an informational blog hub covering Kundli matching rules, Manglik Dosh, and planetary transits will attract significant organic top-of-funnel traffic.

### 3. On-Page SEO & Metadata
- **Index Page Title**: `Book Vedic Astrology Consultation Online | Kundali Analysis | ASTROJAK` (68 characters – optimal length, high click intent).
- **Index Meta Description**: `Book 1:1 Vedic astrology consultation with Acharya Narender Ji. Kundali Analysis, Marriage Matchmaking & remedies on call. 10-min session + report from ₹101.` (163 characters – includes price point and clear CTA).
- **Heading Structure on Index**: Exactly one `<h1>`, followed by logical `<h2>` and `<h3>` tags.
- **Heading Defect on Home**: Four `<h1>` tags identified. Headings for policy modals must be downgraded to `<h2>`.

### 4. Schema Markup & Structured Data
- The `@graph` schema combines:
  - `WebSite`
  - `ProfessionalService`
  - `Person` (Acharya Narender Ji)
  - `OfferCatalog` (4 service offerings with INR pricing)
  - `BreadcrumbList`
  - `FAQPage` (7 questions and answers)
- **Recommendations**:
  - Add `AggregateRating` inside `ProfessionalService`.
  - Fix inverted breadcrumb pointing `/home` as position 1.
  - Add `knowsAbout` array for Acharya Narender Ji.

### 5. Performance (Core Web Vitals)
- **FCP**: Extremely fast due to inlined critical CSS.
- **LCP**: Optimized by WebP format; can be improved by adding `fetchpriority="high"` and a `<link rel="preload">` tag in `<head>`.
- **CLS**: Hero image has explicit dimensions. Adding explicit dimensions to review images will ensure near-zero visual shifts.
- **Speculation Rules**: Adding a `<script type="speculationrules">` block allows browsers to prerender internal navigation on hover.

### 6. AI Search Readiness (GEO & AEO)
- **Bot Matrix Testing**: GPTBot, ClaudeBot, PerplexityBot, and OAI-SearchBot all return HTTP 200 OK without WAF challenges.
- **Citation Readiness**: Direct, factual answers to key user questions provide high citability for Google AI Overviews and ChatGPT.
- **Recommendation**: Publish `/llms.txt` and declare `Content-Signal` in `robots.txt`.

---

## Artifacts Generated

1. Structured Data Envelope: [audit-data.json](file:///D:/Astrojak/astrojak/astrojak.in-audit/audit-data.json)
2. Prioritized Action Plan: [ACTION-PLAN.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/ACTION-PLAN.md)
3. Technical Findings: [findings/technical.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/technical.md)
4. Content & E-E-A-T Findings: [findings/content.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/content.md)
5. Schema Findings: [findings/schema.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/schema.md)
6. Performance Findings: [findings/performance.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/performance.md)
7. Visual Findings: [findings/visual.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/visual.md)
8. AI Search / GEO Findings: [findings/geo.md](file:///D:/Astrojak/astrojak/astrojak.in-audit/findings/geo.md)
9. Viewport Screenshots: [screenshots/](file:///D:/Astrojak/astrojak/astrojak.in-audit/screenshots/)
