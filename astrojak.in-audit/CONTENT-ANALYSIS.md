# Content Quality and E-E-A-T Analysis

**Checked:** 2026-10-31  
**Target:** <https://www.astrojak.in/> and its public service pages  
**Scope note:** This is a content-quality assessment, not a Google ranking score. Automated scores are heuristics, not Google's internal signals.

## Scorecard

**Content quality: 82/100 (qualitative audit estimate)**  
**E-E-A-T heuristic: 73/100**

| E-E-A-T factor | Score | Evidence and limitations |
|---|---:|---|
| Experience | 16/20 | The site presents a named astrologer and client testimonials. The testimonials are largely image-based, which makes the supporting detail less accessible to text extraction. |
| Expertise | 21/25 | Service descriptions name relevant topics such as Kundali analysis, Kundli Milan, Dasha timing, and remedies. Experience and consultation-count claims should be supported and accurately maintained. |
| Authoritativeness | 12/25 | The site establishes its own identity and services, but independent recognition, authoritative references, and off-site mentions were not verified in this check. |
| Trustworthiness | 24/30 | HTTPS, pricing, contact methods, payment information, privacy and refund policies, and a clear booking path are present. Review and rating claims should be supported by visible, verifiable evidence. |

The sub-scores are this audit's qualitative rubric; Google does not publish numeric E-E-A-T weights or a site score.

## Measured page observations

| Page | Title | Description | H1 | Extracted words |
|---|---|---|---|---:|
| `/` | 70 characters | 157 characters | One: “Book Consultation with Acharya Narender Ji” | 663 |
| `/home` | 59 characters | 156 characters | One; spacing needs cleanup | 1,820 |
| `/plan` | 51 characters | 175 characters | One: “Book Consultation with Acharya Narender Ji” | 627 |

Word counts can vary by extractor and are not ranking targets. Google's guidance does not establish a preferred word count.

## Strengths

- The site's offer, pricing, payment method, and booking steps are concrete and easy to understand.
- `/home` has substantive service and policy information; the booking and plan pages answer conversion questions.
- The page extracts include question-and-answer content, descriptive service topics, and one H1 per inspected live page.
- `content_quality.py` returned source-level heuristic scores of 92 for the homepage and 95 for `/home`; `/home` was flagged as repetitive. These scores analyze HTML source, can be affected by markup/scripts, and are not Google metrics.

## Highest-priority improvements

1. **Fix the `/home` H1 spacing:** “Online VedicAstrology Consultation& Kundli Analysis” should read naturally, for example “Online Vedic Astrology Consultation & Kundli Analysis.”
2. **Shorten `/plan` meta description:** it is 175 characters. Keep the distinctive plan and booking information while aiming for a concise snippet; snippet display is ultimately controlled by Google.
3. **Consider tightening the homepage title:** it is 70 characters and overlaps the consultation and Kundali terms. Keep the primary intent and brand, and evaluate changes using Search Console CTR rather than character count alone.
4. **Make proof easier to assess:** provide accessible text for testimonial context where consent permits, and link or describe the basis for credentials, rating, and consultation-count claims. Do not invent endorsements or structured review data.
5. **Expand topical coverage selectively:** use verified customer/search queries to choose a few expert-reviewed guides on Kundali interpretation, marriage compatibility, Dasha/timing, and booking preparation. Avoid publishing near-duplicate or keyword-swapped pages.
6. **Keep the advice transparent:** explain that astrology is guidance, not a guaranteed outcome or substitute for professional advice where applicable; retain clear pricing, privacy, and refund terms.

## Measurement and verification

- Search Console query and page performance is not connected, so organic demand, click-through rate, and ranking movement were not measurable.
- Validate the experience, credentials, testimonial permissions, ratings, and any factual claims with the business before expanding them.
- Track completed bookings and qualified booking starts alongside impressions and clicks.
