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
5. In Cloudflare, open **Workers & Pages → astrojak → Settings → Variables and
   Secrets**. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as encrypted
   secrets. Use Razorpay Test Mode credentials until checkout is tested.
   Saving secrets publishes a new Worker version; never add these Razorpay
   values to GitHub, a workflow, or website files.
6. Confirm `https://api.astrojak.in/create-order` and
   `https://api.astrojak.in/verify-payment` are live. The API hostname is
   configured in `pay.js`; if it differs, update that URL.
7. With Razorpay Test Mode configured, complete a test payment and confirm the
   Worker verifies/captures it and returns to
   `https://www.astrojak.in/thank-you.html`. Test keys are supported by checkout.

The shared checkout script redirects to WhatsApp with “I have to book As soon
as possible” if Razorpay Checkout cannot load/open or a payment fails. A
customer who simply dismisses Checkout can retry normally. If payment
verification fails after submission, the page keeps the existing warning not
to pay again and asks the customer to contact support with the payment ID.

The `astrojak` Worker owns the `api.astrojak.in` custom domain and is the
deployment target in `wrangler.toml`. Keep any older Worker deployment until
the new deployment is healthy, the custom domain is still attached to `astrojak`,
and the API has passed a test checkout. Then remove only the unused old Worker
from **Workers & Pages** if desired.

## Meta Pixel purchase tracking

The website initializes Meta Pixel `2057261584904971` and sends a browser
`Purchase` event from `thank-you.html` only after the checkout flow receives a
successful captured-payment verification from this Worker. The event includes
the plan value in INR, plan name and ID, and the Razorpay payment ID as its
event ID. The browser stores a per-payment marker so refreshing the thank-you
page does not send the same Purchase event again in that browser.

This is Pixel browser tracking, not a direct Razorpay-to-Meta integration or a
server-side Conversions API feed. Browser privacy settings, ad blockers, or
consent restrictions can prevent Pixel events from reaching Meta.

To test it, use a Razorpay Test Mode payment and open **Events Manager → Data
Sources → your Pixel → Test events** while completing checkout. Confirm a
`Purchase` arrives with the expected INR value and plan, and that its event ID
matches the Razorpay payment ID. A page refresh should not send a second
Purchase event from the same browser.

## Paid booking events from Customers Bookings to Meta

After `/append-customer-details` verifies a captured Razorpay payment and
successfully appends (or confirms an existing) row in **Customers Bookings**,
the Worker sends a `Purchase` event to the same Meta Dataset/Pixel used by the
website. This is automatic for new submissions; no Zoho workflow, Apps Script,
or public webhook is required. The payment ID is used as `event_id`, so the
server event can be deduplicated against the browser Pixel Purchase event when
both use the same event name and ID. The event time comes from Razorpay's
payment timestamp. Meta receives a SHA-256 hashed phone number, INR value, and
plan name; the booking remains saved even if Meta is temporarily unavailable.

1. In Meta Events Manager, select the Dataset/Pixel used by the website, open
   **Settings → Conversions API**, and generate an access token using manual
   setup. Copy the Dataset/Pixel ID and token. Keep the token private.
2. In **Workers & Pages → astrojak → Settings → Variables and Secrets**, add:
   - Encrypted secret `META_CAPI_DATASET_ID` — the Dataset/Pixel ID.
   - Encrypted secret `META_CAPI_ACCESS_TOKEN` — the Conversions API token.
   - Variable `META_CAPI_GRAPH_VERSION` — a currently supported Graph API
     version in the format `vNN.0`.
   - Optional variable `META_CAPI_TEST_EVENT_CODE` — only while testing.
3. Configure both the Worker and Razorpay Checkout with Razorpay Test Mode
   credentials. Keep `META_CAPI_TEST_EVENT_CODE` set to the code shown in
   **Events Manager → Test Events**, complete a test payment, and confirm
   `Purchase` appears in Test Events with INR value and plan name.
4. Remove `META_CAPI_TEST_EVENT_CODE` and save the Worker settings before
   sending live events. The endpoint only sends after the payment is verified
   as captured and the booking row is saved. Older spreadsheet rows are not
   backfilled automatically.

The supplied CRM event guide's fields are included: `action_source` is
`system_generated`, `custom_data.event_source` is `crm`, and
`lead_event_source` identifies the Customers Bookings Google Sheet. A Meta
Instant Form `lead_id` is not present in website bookings, so the Worker does
not invent one. The customer's email is not collected on this booking form;
only the available phone identifier is hashed and sent.

## Google Calendar appointments

The thank-you form sends completed customer details to Splitforms. After that
submission succeeds, the Worker verifies the captured Razorpay payment and
creates one event in the configured calendar. The event includes the customer
name, mobile number, plan, selected analysis, discussion topics, and payment
reference. The event also includes the birth date, birth time (when provided),
and birth place submitted on the thank-you form.

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
submit their details again. The retry message includes a safe diagnostic such
as an OAuth rejection reason or Calendar API permission/status code; it never
includes service-account key material.

## Google Sheets lead and booking records

The same `astrojak` Worker appends pre-checkout mobile captures to the
**Pre-Checkout Leads** spreadsheet and completed thank-you form details to the
**Customers Bookings** spreadsheet. No second service account or additional
Worker secret is needed: the existing `GOOGLE_SERVICE_ACCOUNT_JSON` secret is
used for both Sheets and Calendar access. The service account needs **Editor**
access to each spreadsheet.

1. Enable the Google Sheets API in the Google Cloud project that owns the
   service account.
2. Share spreadsheet
   [Pre-Checkout Leads](https://docs.google.com/spreadsheets/d/10dAPMDIUQQVKuhYj8uww9atBGbdOSATJ_0AoxawN22g/edit)
   and spreadsheet
   [Customers Bookings](https://docs.google.com/spreadsheets/d/1Ecr2oISzV7vJY5CJyu9QNyd-E1TxaENOcbns31X3fOk/edit)
   with the service account email shown in `GOOGLE_SERVICE_ACCOUNT_JSON`, with
   **Editor** permission.
3. The Worker uses a worksheet tab with the exact name shown above when it
   exists; otherwise it uses the spreadsheet's first worksheet tab. Add these
   headers to the first row of the tab that will receive records:
   - **Pre-Checkout Leads:** Timestamp, Mobile, Payment plan, Selected
     analysis, Discussion topics, Amount (INR), Appointment date, Appointment
     time, Source / page.
   - **Customers Bookings:** Timestamp, Payment ID, Customer name, Mobile,
     Payment plan, Selected analysis, Discussion topics, Appointment date,
     Appointment time, Amount paid (INR), Date of birth, Birth time, Birth
     place, Payment reference, Page.
4. Confirm `GOOGLE_SERVICE_ACCOUNT_JSON` is saved as an encrypted secret on
   **Workers & Pages → astrojak → Settings → Variables and Secrets**. The two
   spreadsheet IDs and worksheet names are configured in the Worker code; no
   `GOOGLE_SHEETS_SPREADSHEET_ID` secret is used.
5. Deploy the Worker and website. A pre-checkout Sheets request is best-effort
   and does not delay or prevent Razorpay from opening. The thank-you form
   requires the booking row to be saved before it reports success; if saving
   fails, the customer can retry. Splitforms notification is best-effort after
   the Sheets save, so an unavailable Splitforms service does not block a
   successful booking. Retries for a payment ID do not create a second booking
   row.

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
  `calendar.events` scope; Sheets writes use the `spreadsheets` scope.
- Rotate/revoke any Razorpay key that has ever been committed or shared.
- Configure a Cloudflare rate-limiting rule for
  `api.astrojak.in/create-order`, `api.astrojak.in/verify-payment`, and
  `api.astrojak.in/create-calendar-event`, `api.astrojak.in/append-checkout-lead`,
  `api.astrojak.in/append-customer-details`
  before enabling live payments.

## Local checks

```sh
node --check cloudflare/worker.mjs
```
