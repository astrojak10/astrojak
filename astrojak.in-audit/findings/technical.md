# Technical SEO Audit: https://www.astrojak.in/

**Score: 82 / 100**  
**Category Weight: 22%**

---

## 1. Crawlability & Indexability

- **robots.txt (`https://www.astrojak.in/robots.txt`)**:
  - Directives:
    ```txt
    User-agent: *
    Allow: /
    Disallow: /thank-you
    Disallow: /thank-you.html
    Sitemap: https://www.astrojak.in/sitemap.xml
    ```
  - **Status**: Valid. Conversion pages (`/thank-you`) are properly isolated to avoid index bloat and duplicate content.
  - **Improvement**: Currently, all crawlers (including LLM agents) fall through to the wildcard `*` block. Adding explicit groups and `Content-Signal` enhances agentic crawl transparency.

- **sitemap.xml (`https://www.astrojak.in/sitemap.xml`)**:
  - Found and verified: HTTP 200, valid `urlset` XML schema.
  - Contains:
    - `https://www.astrojak.in/` (priority: 1.0, changefreq: weekly)
    - `https://www.astrojak.in/home` (priority: 0.9, changefreq: weekly)
  - **Improvement**: Incorporate Google Image Sitemap tags (`<image:image>`, `<image:loc>`) for the pandit profile image and verification badges to drive Google Images traffic.

- **Canonicals & Redirects**:
  - Root Canonical: `https://www.astrojak.in/` (matches current URL).
  - Secondary Canonical: `https://www.astrojak.in/home` (matches current URL).
  - Cloudflare / Netlify Redirects (`_redirects`):
    - Non-www to www: 301 permanent redirect configured.
    - Legacy Netlify subdomain to custom domain: 301 redirect configured.
    - Legacy `/book` and `/book.html` redirected to `/`.

---

## 2. HTTP Security & Response Headers

- **Server**: Cloudflare Edge CDN.
- **Cache-Control**: `max-age=600` (10 minutes) on HTML.
- **Security Header Gaps**:
  - `Strict-Transport-Security` (HSTS): **Missing**
  - `Content-Security-Policy` (CSP): **Missing**
  - `X-Content-Type-Options: nosniff`: **Missing**
  - `Referrer-Policy: strict-origin-when-cross-origin`: **Missing**
  - `Permissions-Policy`: **Missing**

### Recommended Fix: Add `_headers` file for Cloudflare Pages

```http
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```
