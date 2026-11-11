# Payment API on Cloudflare Workers

The website is static on GitHub Pages. This Worker creates and verifies
Razorpay, Cashfree, PayU, Easebuzz, or Paytm PG payments without exposing gateway credentials to visitors
or the GitHub Pages build. The active gateway is selected in
`/payment-admin.html`; only one gateway handles new checkouts at a time.

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
4. Create a Cloudflare Workers KV namespace named `PAYMENT_SETTINGS` in the
   Cloudflare dashboard (or with Wrangler). Replace
   `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with its namespace ID.
   The namespace stores active gateway/environment settings and expiring Paytm
   order metadata used to verify payments and recover booking details.
   You can create it with `npx wrangler kv namespace create PAYMENT_SETTINGS`.
   KV setting changes can take up to about a minute to propagate globally.
5. Deploy the Worker using the `Deploy payment API` GitHub Actions workflow.
   The `api.astrojak.in` custom domain is declared in `wrangler.toml`.
6. In Cloudflare, open **Workers & Pages → astrojak → Settings → Variables and
   Secrets**. Add these as encrypted secrets (never commit or publish them):
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `CASHFREE_APP_ID`
   - `CASHFREE_SECRET_KEY`
   - `PAYU_MERCHANT_KEY`
   - `PAYU_MERCHANT_SALT`
   - `EASEBUZZ_KEY`
   - `EASEBUZZ_SALT`
   - `PAYTM_STAGING_MID`
   - `PAYTM_STAGING_MERCHANT_KEY`
   - `PAYTM_PRODUCTION_MID`
   - `PAYTM_PRODUCTION_MERCHANT_KEY`
   - `ADMIN_USERNAME` — the username you will use to sign in.
   - `ADMIN_PASSWORD` — a unique password of at least 12 characters.
   - `ADMIN_SESSION_SECRET` — a separate random value of at least 32
     characters used to sign eight-hour admin sessions. Generate one in
     PowerShell with:
     ```powershell
     $bytes = New-Object byte[] 48
     [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
     [Convert]::ToBase64String($bytes)
     ```
     Save the output privately, then paste it as the secret value in Cloudflare.
   Remove the old `ADMIN_API_TOKEN` secret if you configured it previously; the
   username/password login replaces it.
   Set Cashfree, PayU, Easebuzz, and Paytm credentials to match the environments selected in
   the admin page. PayU and Easebuzz use the merchant Key and Salt (not
   OAuth Client ID/Client Secret). Paytm staging and production MID/Key pairs
   are separate; add each pair for the environment you plan to use. The Paytm
   Merchant Key must be 16 characters. In the Cashfree dashboard, whitelist
   `www.astrojak.in` for web checkout. Avoid changing gateway environments
   while payments are in progress. Use test credentials until checkout is tested.
7. Confirm `https://api.astrojak.in/payment-config`,
   `https://api.astrojak.in/create-order`, and
   `https://api.astrojak.in/verify-payment` are live. The API hostname is
   configured in `pay.js`; if it differs, update that URL.
8. Open `https://www.astrojak.in/admin` (or
   `https://www.astrojak.in/payment-admin.html`) and sign in with
   `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Select a gateway whose credentials
   are configured and save. Sessions use an HttpOnly, Secure cookie and expire
   after eight hours. Cashfree, PayU, Easebuzz, and Paytm credentials must match their selected
   environments.
   The page never accepts gateway secrets; manage those only in Cloudflare
   Worker secrets.
9. Complete a test payment and confirm the Worker verifies it and returns to
   `https://www.astrojak.in/thank-you.html`. Test keys are supported by checkout.

If the admin page says the payment API is outdated, redeploy the
**Deploy payment API** workflow from the `main` branch. Confirm
`/payment-config` includes `payuMode`, `easebuzzMode`, and `paytmMode`, and a GET to
`/payu-callback` returns 405 before trying to enable either gateway again. If those checks still show the old
Worker after a successful deployment, check that `api.astrojak.in` is routed
to the `astrojak` Worker in the same Cloudflare account used by GitHub Actions.

The shared checkout script preloads the active gateway SDK for faster checkout.
Razorpay retains its existing WhatsApp fallback on checkout errors, and a
customer who dismisses Razorpay checkout can retry normally. Cashfree's hosted
checkout is mounted inline inside a responsive, same-page overlay; closing it
leaves the customer on the booking page so they can retry.
After a Cashfree payment attempt, the Worker verifies the order directly with
Cashfree before navigating to the thank-you page. Cashfree's documented
embedded checkout can still request its redirect fallback in unsupported
in-app browsers.

Paytm PG uses the server-side Initiate Transaction API and the Paytm JS Checkout
SDK. The SDK is mounted into a responsive partial-screen modal; after it closes,
the Worker checks the signed Transaction Status API response before marking the
order paid. The customer checkout collects only a mobile number for Paytm; an
email field is shown only when the enabled gateway requires it (PayU or
Easebuzz). Choose staging or production in the admin page to select the matching
Paytm MID and Merchant Key. See [Paytm API
documentation](https://www.paytmpayments.com/docs), [Initiate Transaction
API](https://www.paytmpayments.com/docs/api/initiate-transaction-api),
[JS Checkout](https://www.paytmpayments.com/docs/jscheckout-invoke-payment),
[Transaction Status API](https://www.paytmpayments.com/docs/api/v3/transaction-status-api),
and [Checksum implementation](https://www.paytmpayments.com/docs/checksum-implementation).

GitHub Pages does not process the `_redirects` file, so `/admin` is provided
by the static `admin/index.html` redirect page as well as the existing
`/payment-admin.html` page.

PayU Hosted Checkout is created with a server-generated SHA-512 hash and
displayed in a responsive partial-screen modal. Its callback is routed through
the Worker, and the Worker verifies each transaction with PayU's
`verify_payment` API before marking the booking paid. If a browser cannot
embed the PayU page, the modal offers a new-tab fallback. See the [PayU API
reference](https://docs.payu.in/reference/introduction-api-reference) and
[Hosted Checkout integration guide](https://docs.payu.in/docs/prebuilt-checkout-page-integration).

Easebuzz is initiated server-side with the merchant Key and Salt and a
SHA-512 request hash. Its documented EaseCheckout iframe provides the modal
checkout, and the Worker verifies the final transaction using Easebuzz
Transaction API V2.1 before marking a booking paid. Easebuzz checkout requires
a customer email and mobile number. Set the test/production environment in the
admin page to match the corresponding Easebuzz credentials. See the
[Initiate Payment API](https://docs.easebuzz.in/docs/payment-gateway/8ec545c331e6f-initiate-payment-api),
[EaseCheckout iframe integration](https://docs.easebuzz.in/docs/payment-gateway/7zfogdgdwb9c8-i-frame-integration-ease-checkout),
and [Transaction API V2.1](https://docs.easebuzz.in/docs/payment-gateway/f607brr7f8ek8-transaction-api-v2-1).

The `astrojak` Worker owns the `api.astrojak.in` custom domain and is the
deployment target in `wrangler.toml`. Keep any older Worker deployment until
the new deployment is healthy, the custom domain is still attached to `astrojak`,
and the API has passed a test checkout. Then remove only the unused old Worker
from **Workers & Pages** if desired.

Cashfree follows its hosted web checkout flow: [create an order on the
server, open the payment session with the JavaScript SDK, then verify the
order server-side](https://www.cashfree.com/docs/payments/online/web/redirect).

## Meta Pixel purchase tracking

The website initializes Meta Pixel `2057261584904971` and sends a browser
`Purchase` event from `thank-you.html` only after the checkout flow receives a
successful payment verification from this Worker. The event includes
the plan value in INR, plan name and ID, and the gateway payment ID (the
Cashfree order ID, PayU `mihpayid`, Easebuzz `easepayid`, or Paytm `txnId` for those transactions). The browser stores a per-payment marker so refreshing the thank-you
page does not send the same Purchase event again in that browser.

This is Pixel browser tracking, not a direct Razorpay-to-Meta integration or a
server-side Conversions API feed. Browser privacy settings, ad blockers, or
consent restrictions can prevent Pixel events from reaching Meta.

To test it, use a payment in the selected gateway's test environment and open **Events Manager → Data
Sources → your Pixel → Test events** while completing checkout. Confirm a
`Purchase` arrives with the expected INR value and plan, and that its event ID
matches the payment identifier. A page refresh should not send a second
Purchase event from the same browser.

## Lead and paid booking events from the website to Meta

When a visitor submits a mobile number to start checkout, the Worker sends a
`Lead` event. If the person later completes payment and submits the thank-you
form, the Worker verifies the payment with the selected provider, saves (or finds) the
row in **Customers Bookings**, and sends a `Purchase` event. Meta can then
compare leads that progressed to paid bookings with leads that did not. No
separate "not converted" event is sent; non-conversion is represented by a
Lead without a corresponding Purchase. Both events use SHA-256 hashed phone
matching data. The Purchase includes its INR value and plan. Meta delivery is
best-effort and does not block the Sheets write or checkout.

1. In Meta Events Manager, select the Dataset/Pixel used by the website, open
   **Settings → Conversions API**, and generate an access token using manual
   setup. Copy the Dataset/Pixel ID and token. Keep the token private.
2. In **Workers & Pages → astrojak → Settings → Variables and Secrets**, add:
   - Encrypted secret `META_CAPI_DATASET_ID` — the Dataset/Pixel ID.
   - Encrypted secret `META_CAPI_ACCESS_TOKEN` — the Conversions API token.
   - Variable `META_CAPI_GRAPH_VERSION` — a currently supported Graph API
     version in the format `vNN.0`.
   - Optional variable `META_CAPI_TEST_EVENT_CODE` — only while testing.
3. Configure the Worker with test credentials and select the test gateway in
   `/payment-admin.html`. Keep `META_CAPI_TEST_EVENT_CODE` set to the code shown in
   **Events Manager → Test Events**, submit the checkout mobile form and
   complete a test payment. Confirm `Lead` and then `Purchase` appear in Test
   Events; the Purchase should show the INR value and plan name.
4. Remove `META_CAPI_TEST_EVENT_CODE` and save the Worker settings before
   sending live events. The endpoint only sends after the payment is verified
   as captured and the booking row is saved. Older spreadsheet rows are not
   backfilled automatically.
5. To troubleshoot, open **Workers & Pages → astrojak → Observability → Logs**
   for the test time. Successful sends log
   `Meta Conversions API accepted checkout lead event` or
   `Meta Conversions API accepted paid booking event`. Failures log the event
   type and a diagnostic without including the access token or unhashed phone.

The website Lead event uses `action_source: website` and the page URL where
checkout began. The Purchase uses `action_source: website` and the thank-you page. Razorpay
uses the captured payment timestamp; Cashfree reports the booking verification
time because its order lookup does not expose a payment timestamp. Easebuzz
reports the transaction timestamp from its Transaction API. A Meta Instant Form `lead_id` is not
available for website leads, so the Worker does not invent one. The booking
form does not collect email; the customer's phone is hashed and sent.

## Google Calendar appointments

The thank-you form sends completed customer details to Splitforms. After that
submission succeeds, the Worker verifies the payment with its provider and
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
5. Test using a captured test payment and a dedicated test calendar. Check
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
   and does not delay or prevent the payment gateway from opening. The thank-you form
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
- Razorpay checkout signatures are checked with the Razorpay secret. The
  Worker confirms the payment belongs to the order and captures authorized
  payments before reporting success. Cashfree completion is verified by
  retrieving the order server-side and requiring the `PAID` status, expected
  plan, amount, and INR currency. PayU success is reconciled with
  `verify_payment`; Easebuzz success is reconciled with Transaction API V2.1;
  Paytm success is reconciled with the signed Transaction Status API response.
  The Worker checks transaction status, plan, amount, product, and appointment
  before reporting success.
- Only the listed website origins and the local development origin are allowed
  by CORS. CORS is not authentication; the server-side plan/amount validation
  is still required.
- The Worker returns only public checkout data (Razorpay key ID, Cashfree
  payment-session ID, or PayU/Easebuzz/Paytm checkout tokens and public merchant IDs); it
  never returns or logs private keys, salts, or API secrets. Gateway failure
  details are deliberately not exposed.
- `/admin/payment-settings` requires a valid, signed eight-hour admin session.
  Login credentials and the session signing key are Cloudflare encrypted
  secrets; the session cookie is Secure, HttpOnly, and scoped to the admin API.
  Payment settings are stored in the dedicated KV namespace, not in the website
  or source tree. Apply Cloudflare rate limiting to `/admin/login`.
- Google service-account credentials are stored only as Cloudflare encrypted
  secrets. Calendar event creation rechecks the payment and uses the
  `calendar.events` scope; Sheets writes use the `spreadsheets` scope.
- Rotate/revoke any gateway key, admin password, or session secret that has
  ever been committed or shared.
- Configure a Cloudflare rate-limiting rule for
  `api.astrojak.in/create-order`, `api.astrojak.in/verify-payment`, and
  `api.astrojak.in/create-calendar-event`, `api.astrojak.in/append-checkout-lead`,
  `api.astrojak.in/append-customer-details`, and
  `api.astrojak.in/admin/payment-settings`
  before enabling live payments.

## Local checks

```sh
node --check cloudflare/worker.mjs
node --check pay.js
```
