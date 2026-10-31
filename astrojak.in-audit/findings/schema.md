# Schema & Structured Data Audit: https://www.astrojak.in/

**Score: 84 / 100**  
**Category Weight: 10%**

---

## 1. Existing JSON-LD Schema Blocks

The site implements a rich `@graph` array on `index.html` containing:
1. `WebSite`
2. `ProfessionalService` (with founder `Person`, `hasOfferCatalog`, `Offer`, `areaServed`, `telephone`, `email`, `priceRange`)
3. `BreadcrumbList`
4. `FAQPage` (7 structured Q&As matching visible accordion text)

---

## 2. Issues & Opportunities

### 1. Missing `AggregateRating` for Google Star Rich Snippets (High Priority)
- **Problem**: The page displays a visual rating ("⭐ 4.98 rating · 1000+ consultations"), but no `aggregateRating` markup is embedded in Schema.org.
- **Impact**: Google search results display flat text rather than prominent yellow star ratings, reducing click-through rate (CTR) by 15-30%.
- **Fix**: Add the following inside the `ProfessionalService` object:
  ```json
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.98",
    "reviewCount": "1000",
    "bestRating": "5",
    "worstRating": "1"
  }
  ```

### 2. Inverted BreadcrumbList Structure (Medium Priority)
- **Problem**: On `index.html`, the breadcrumb hierarchy is:
  - Position 1: `https://www.astrojak.in/home` ("Home")
  - Position 2: `https://www.astrojak.in/` ("Book Consultation")
- **Impact**: Inverted logical path confuses search engine crawlers regarding the site's top-level root.
- **Fix**: Set Position 1 to `https://www.astrojak.in/` ("Home").

### 3. Entity Enhancement for Acharya Narender Ji
- **Opportunity**: Enhance the `founder` entity with `knowsAbout` and `alumniOf`/`sameAs` properties:
  ```json
  "knowsAbout": [
    "Vedic Astrology",
    "Janam Kundali Analysis",
    "Kundli Matching",
    "Jyotish Shastra",
    "Vedic Remedies"
  ]
  ```
