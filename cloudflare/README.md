# Razorpay payment API on Cloudflare Workers

The website is static on GitHub Pages. This Worker creates Razorpay orders and
verifies captured payments without exposing Razorpay credentials to visitors or
the GitHub Pages build. Checkout opens in Razorpay's on-page modal.

## One-time setup

1. Add `astrojak.in` to Cloudflare and verify the DNS records Cloudflare imports.
   At BigRock, change the domain nameservers to the pair Cloudflare assigns.
   Confirm the website and any email records work before continuing. A Worker
   custom domain requires the domain's DNS zone to be active in Cloudflare.
2. In Cloudflare, create an API token for Wrangler deployment with Account
   **Workers Scripts: Edit** and **Account Settings: Read** permissions. Include
   **Zone: Read** and **DNS: Edit** for the `astrojak.in` zone so Wrangler can
   provision the `api.astrojak.in` custom domain. Limit the token to this
   account and zone.
3. In this GitHub repository, add Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Deploy the Worker using the `Deploy payment API` GitHub Actions workflow.
   The `api.astrojak.in` custom domain is declared in `wrangler.toml`.
5. In Cloudflare, open **Workers & Pages → astrojak-payment-api → Settings →
   Variables and Secrets**. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as
   encrypted secrets. Use Razorpay Test Mode credentials until checkout is
   tested. Saving secrets publishes a new Worker version; never add these
   Razorpay values to GitHub, a workflow, or website files.
6. Confirm `https://api.astrojak.in/create-order` and
   `https://api.astrojak.in/verify-payment` are live. The API hostname is
   configured in `pay.js`; if it differs, update that URL.
7. Test a payment in Razorpay Test Mode and confirm Checkout opens over the
   booking page, the server verifies and captures the payment, and success
   returns to `https://www.astrojak.in/thank-you.html`.

## Google Calendar appointments

The thank-you form sends completed customer details to Splitforms. After that
submission succeeds, the Worker verifies the captured Razorpay payment and
creates one event in the configured calendar. The event includes the customer
name, mobile number, plan, selected analysis, discussion topics, and payment
reference; birth date, birth time, and birth place are not added to Calendar.

1. Enable the Google Calendar API in the Google Cloud project used by the
   service account.
2. Share the target calendar with the service account email and grant it
   **Make changes to events** access.
3. In the Cloudflare Worker settings, add these as encrypted secrets:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the complete service-account JSON key.
   - `GOOGLE_CALENDAR_ID` — the target calendar's ID.
4. Deploy the Worker and website changes. The Worker uses a short-lived Google
   access token and a payment-derived event ID, so retrying the Calendar sync
   does not create duplicate events.
5. Test using a captured Razorpay payment and a dedicated test calendar. Check
   that the event has the correct date, 3-hour slot, and India Standard Time.

If Calendar is unavailable after the customer details are accepted, the
thank-you page shows a separate retry action. The customer should not need to
submit their details again.

## Security notes

- The browser submits a plan identifier; the Worker uses the server-side
  `pricing.js` plan data when creating each order and verifies the returned
  amount and currency against that plan. It does not accept a client-supplied
  amount. A change to `pricing.js` triggers both the static-site and Worker
  deployments.
- Checkout signatures are checked with the Razorpay secret. The Worker then
  confirms the payment belongs to the order and captures authorized payments
  before reporting success.
- Only the listed website origins and the local development origin are allowed
  by CORS. CORS is not authentication; the server-side plan/amount validation
  is still required.
- The Worker returns the public key ID, order ID, amount, and reference; it
  never returns or logs credentials. Razorpay failure details are deliberately
  not exposed.
- Google service-account credentials are stored only as Cloudflare encrypted
  secrets. Calendar event creation rechecks the payment and uses the
  `calendar.events` scope.
- Rotate/revoke any Razorpay key that has ever been committed or shared.
- Configure a Cloudflare rate-limiting rule for
  `api.astrojak.in/create-order`, `api.astrojak.in/verify-payment`, and
  `api.astrojak.in/create-calendar-event` before enabling live payments.

## Local checks

```sh
node --check cloudflare/worker.mjs
```
