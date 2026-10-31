# Performance & Core Web Vitals Audit: https://www.astrojak.in/

**Score: 80 / 100**  
**Category Weight: 10%**

---

## 1. Core Web Vitals Status

- **First Contentful Paint (FCP)**: **Fast (<1.2s)**
  - All critical styles are inlined in `<style>` blocks in `<head>`, removing external CSS network request bottlenecks.
  - No client-side framework (React/Vue/Angular) hydration delay; 100% server-rendered static HTML.
- **Cumulative Layout Shift (CLS)**: **Low Risk, Needs Explicit Attributes**
  - Hero image `pandit.webp` has explicit `width="132" height="132"` (on index) and `width="360" height="482"` (on home).
  - Review testimonial images (`review-01.jpg`, `review-02.jpg`, `review-03.jpg`) use `loading="lazy"` but lack explicit `width` and `height` attributes, which can induce minor layout shifts upon scroll.
- **Largest Contentful Paint (LCP)**:
  - Hero image `/pandit.webp` is the primary LCP candidate.
  - Currently loaded without priority hint. Adding `fetchpriority="high"` and a `<link rel="preload">` tag in `<head>` ensures immediate prioritization by the browser preload scanner.

---

## 2. Resource Optimization & Third-Party Scripts

1. **Third-Party Pixel & Tracking**:
   - Facebook Pixel (`connect.facebook.net` and `facebook.com/tr`) runs in the background. Ensure it does not block the main thread by deferring until user interaction.
   - Razorpay Checkout script (`checkout.razorpay.com/v1/checkout.js`) is loaded dynamically when the user clicks the payment button—an optimal approach.
2. **Speculation Rules (Prerendering)**:
   - Modern browsers support `<script type="speculationrules">` to prefetch and prerender internal pages when hovered:
     ```html
     <script type="speculationrules">
     {
       "prerender": [
         {
           "source": "list",
           "urls": ["/home"]
         }
       ]
     }
     </script>
     ```
