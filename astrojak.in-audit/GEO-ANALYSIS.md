# AI Search Readiness (GEO) Analysis

**Checked:** 2026-10-31  
**Target:** <https://www.astrojak.in/>  
**Important:** The readiness score below is an internal heuristic, not a Google score or a measurement of citations, rankings, or traffic.

## GEO readiness

**Estimated readiness: 72/100 (heuristic).**

| Factor | Score | Evidence |
|---|---:|---|
| Citability | 16/25 | Service, pricing, booking, and FAQ information is available. Stronger independent sourcing for factual expertise and reputation claims would improve verifiability. |
| Structural readability | 15/20 | Public pages have descriptive headings and FAQs; clarify the `/home` H1 wording and keep each page's purpose distinct. |
| Multi-modal content | 11/15 | Relevant images and customer-testimonial imagery are present; image-only proof is less accessible to text extraction. |
| Authority and brand evidence | 12/20 | The site identifies its expert and contact channels. Independent mentions and profiles were not checked, so this factor is limited by unavailable evidence. |
| Technical accessibility | 18/20 | The homepage returns 200, primary content is present without JavaScript, robots.txt is reachable, and AI discovery files are available. |

No platform-specific score is reported: Google AI Overviews, ChatGPT, and Perplexity citations were not measured with Search Console or a citation-monitoring tool.

## Crawler access

The live robots.txt allows crawling at the root by default and has explicit allow groups for GPTBot, ClaudeBot, and PerplexityBot. These capabilities are distinct:

| User agent | Capability | Observed policy |
|---|---|---|
| Googlebot | Google Search indexing, including Google AI Search features | Allowed by the general `User-agent: *` group |
| OAI-SearchBot | OpenAI search indexing/citability | Allowed by the general group; no dedicated group observed |
| GPTBot | OpenAI model training | Explicitly allowed |
| Claude-SearchBot | Anthropic search citability | Allowed by the general group; no dedicated group observed |
| ClaudeBot | Anthropic model training | Explicitly allowed |
| PerplexityBot | Perplexity search | Explicitly allowed |
| Google-Extended | Gemini/Vertex AI training and grounding controls | Not blocked; this does not determine Google Search or AI Overview inclusion |
| CCBot | Common Crawl | Allowed by the general group |

“Allowed” describes robots.txt policy, not successful indexing, citation, or a guarantee that a platform will use the content.

## Technical and discovery checks

- Homepage returned HTTP 200; raw-HTML check found approximately 750 words without JavaScript and no SPA-shell marker.
- `robots.txt` returned 200 and declares the sitemap.
- `/llms.txt` and `/llms-full.txt` both returned 200.
- `Content-Signal: search=yes, ai-input=yes, ai-train=no` is present in robots.txt. It expresses a preference; it is not an enforcement mechanism or a ranking signal.
- `/index.md` returned 404 and the HTML response did not offer a Markdown alternate. Markdown delivery is optional and is not required for Google visibility.
- The live-site scan identified no blocking P0/P1 GEO checks. WebMCP availability was informational/not measured; several specialized `.well-known` agent endpoints were not applicable.

`llms.txt` is already available, but it should not be treated as a Google ranking or citation lever. Google says AI-search optimization remains SEO and does not require `llms.txt` or AI-specific content formats.

## Platform status

| Surface | Readiness evidence | Actual visibility |
|---|---|---|
| Google AI Overviews | Googlebot access, crawlable raw HTML, and substantive service information | Not measured; no Search Console access or citation data |
| ChatGPT Search | OAI-SearchBot is allowed by the general robots group | Not measured; GPTBot training access is a separate capability |
| Perplexity | PerplexityBot is explicitly allowed | Not measured |
| Claude search | Claude-SearchBot is allowed by the general robots group | Not measured; ClaudeBot training access is separate |

Brand mentions on Wikipedia, Reddit, YouTube, and LinkedIn were not verified. Do not infer either presence or absence from this crawl.

## Recommendations

1. Connect Search Console and measure eligible organic queries, impressions, clicks, and conversions before attributing changes to AI search.
2. Strengthen high-intent pages with concise, answer-first explanations of consultation scope, Kundali analysis, marriage compatibility, pricing, privacy, and next steps.
3. Support expertise, ratings, and consultation-count claims with accurate, verifiable evidence; make testimonial context text-accessible where consent permits.
4. Publish only a small number of expert-reviewed informational guides selected from verified query/customer questions, with named authorship, sources for factual claims, and appropriate update dates.
5. Keep official business facts, service descriptions, contact details, and author identity consistent across the site and any genuine external profiles. Do not manufacture reviews or platform mentions.
6. Treat `llms.txt` and `Content-Signal` as useful descriptive/policy aids, not substitutes for useful content, crawlability, reputation, or Search Console measurement.

## Measurement plan

- Establish a baseline for Google queries/pages and booking conversions in Search Console and analytics.
- Check a fixed set of relevant queries manually or with a documented monitoring tool across Google, ChatGPT Search, and Perplexity; record date, locale, query, cited URL, and whether ASTROJAK appears.
- Review monthly. Separate crawler access, organic rankings, AI citations, and business outcomes in reporting.
