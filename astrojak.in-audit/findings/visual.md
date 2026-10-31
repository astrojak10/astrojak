# Visual & Viewport Analysis: https://www.astrojak.in/

**Score: 82 / 100**  
**Category Weight: 5%**

---

## 1. Viewport & Multi-Device Testing

Screenshots were captured and evaluated across all standard form factors:
- Desktop: `screenshots/www_astrojak_in_desktop.png` (1920x1080)
- Laptop: `screenshots/www_astrojak_in_laptop.png` (1366x768)
- Tablet: `screenshots/www_astrojak_in_tablet.png` (768x1024)
- Mobile: `screenshots/www_astrojak_in_mobile.png` (375x667)

---

## 2. Key Observations

- **Viewport Meta**: Present (`<meta name="viewport" content="width=device-width, initial-scale=1">`).
- **Horizontal Scroll**: None detected across any device profile.
- **Font Readability**: Base font size is 16px with sufficient contrast against dark background.
- **Above-the-Fold Analysis**:
  - `h1_visible`: **True** (Prominently displayed)
  - `hero_image`: **Visible** (`/pandit.webp`)
  - `cta_visible`: **False on compact mobile screens**!
    - On standard mobile viewports (e.g. iPhone SE / 375px width), the primary booking CTA button is pushed just beneath the initial fold due to the headline, trust badges, and introductory copy.
    - **Recommendation**: Introduce a sticky bottom booking bar on mobile (`Pay ₹101 Reserve Slot`) or compact the vertical padding above the hero button.
