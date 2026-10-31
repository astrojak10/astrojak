# Prioritized Action Plan: ASTROJAK (https://www.astrojak.in/)

This action plan categorizes every recommendation by priority, effort, and projected impact.

---

## Phase 1: Critical Fixes & SERP Rich Snippets (Immediate: Week 1)

| Task | Priority | Category | Effort | Estimated Impact | Action Required |
|------|----------|----------|--------|------------------|-----------------|
| **1. Fix Multiple H1 Tags on `/home`** | Critical | On-Page SEO | 15 mins | High | In `home.html`, change `<h1>Refund Policy</h1>`, `<h1>Privacy Policy</h1>`, and `<h1>Terms of Service</h1>` to `<h2>`. Retain only the hero title as `<h1>`. |
| **2. Add AggregateRating to JSON-LD Schema** | High | Schema | 15 mins | Very High | In `index.html` and `home.html`, add `"aggregateRating": {"@type": "AggregateRating", "ratingValue": "4.98", "reviewCount": "1000"}` under `ProfessionalService` to unlock star ratings in search snippets. |
| **3. Fix Inverted Breadcrumb Schema** | Medium | Schema | 10 mins | Medium | On `index.html`, set position 1 to `https://www.astrojak.in/` ("Home") instead of pointing to `/home`. |
| **4. Fix Spacing in Heading Tags** | Low | On-Page SEO | 5 mins | Low | Insert spaces in `"Need Clear Answers? Ask Your Kundli"` and `"Online Vedic Astrology Consultation & Kundli Analysis"`. |

---

## Phase 2: Performance & Core Web Vitals (Week 2)

| Task | Priority | Category | Effort | Estimated Impact | Action Required |
|------|----------|----------|--------|------------------|-----------------|
| **5. Add LCP Priority & Preload Hints** | Medium | Performance | 10 mins | Medium | Add `fetchpriority="high"` on `<img src="/pandit.webp">` and `<link rel="preload" as="image" href="/pandit.webp">` in `<head>`. |
| **6. Add Dimensions to Review Images** | Medium | Performance | 15 mins | Medium | Add explicit `width="360" height="480"` attributes on testimonial JPGs in `index.html` to eliminate CLS risk. |
| **7. Deploy Cloudflare Security Headers** | Medium | Technical | 15 mins | Medium | Add a `_headers` file to include HSTS, CSP, and `X-Content-Type-Options: nosniff`. |
| **8. Implement Speculation Rules** | Low | Performance | 10 mins | Low | Add `<script type="speculationrules">` to prefetch `/home` on hover for instantaneous page transitions. |

---

## Phase 3: AI Search & Generative Engine Optimization (GEO) (Weeks 3-4)

| Task | Priority | Category | Effort | Estimated Impact | Action Required |
|------|----------|----------|--------|------------------|-----------------|
| **9. Publish `/llms.txt` and `/llms-full.txt`** | Medium | AI Search (GEO) | 30 mins | High | Create markdown discovery documents outlining ASTROJAK services, Acharya Narender Ji's credentials, pricing tiers, and contact info for LLMs. |
| **10. Declare AI Bot Directives in `robots.txt`** | Low | AI Search (GEO) | 10 mins | Medium | Add explicit named crawler groups for `GPTBot`, `ClaudeBot`, and `PerplexityBot` with a `Content-Signal` policy. |
| **11. Add Mobile Sticky CTA Bar** | Medium | UX / Conversion | 30 mins | High | Add a persistent bottom booking bar (`Pay ₹101 Reserve Slot`) on mobile screens to ensure the CTA is always accessible. |

---

## Phase 4: Long-Term Authority & Content Expansion (Month 2+)

| Task | Priority | Category | Effort | Estimated Impact | Action Required |
|------|----------|----------|--------|------------------|-----------------|
| **12. Launch Topic Cluster / Educational Guides** | High | Content Strategy | Ongoing | Very High | Publish pillar articles on high-volume queries: Kundli Milan, Manglik Dosh, Sade Sati, Kundli remedies, and birth chart timing. |
| **13. Connect Google Search Console & CrUX** | High | Monitoring | 30 mins | High | Verify property in GSC, submit `sitemap.xml`, and track real user Core Web Vitals (CrUX) field data. |
| **14. Convert Review Images to WebP** | Low | Performance | 20 mins | Low | Convert `review-01.jpg` through `review-03.jpg` to WebP format to reduce total page weight by ~50KB. |
