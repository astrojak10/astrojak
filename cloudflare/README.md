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

## Google Sheets customer details

After the customer submits the thank-you form, the page sends the form details
to the Worker. The Worker verifies the captured Razorpay payment and appends
one row to the `Customers` tab before sending the existing Splitforms
notification. It uses the payment ID to avoid duplicate rows when the customer
retries. Google credentials stay in Cloudflare and are never sent to the
browser.

1. In the Google Cloud project used by the service account, enable the Google
   Sheets API.
2. Create a Google spreadsheet and add a tab named exactly `Customers`.
   Set row 1 to these headers, in this order:

   ```text
   Submitted At,Payment ID,Payment Reference,Payment Status,Plan,Selected Analysis,Amount (INR),Appointment Date,Appointment Time (IST),Discussion Topics,Customer Name,Mobile,Date of Birth,Birth Time,Birth Place,Page URL
   ```

3. Share the spreadsheet with the service account email as an **Editor**.
   The email is the `client_email` value in the service-account JSON.
4. Copy the spreadsheet ID from its URL (`/spreadsheets/d/<ID>/edit`).
5. In Cloudflare, open **Workers & Pages → astrojak-payment-api → Settings →
   Variables and Secrets** and add `GOOGLE_SHEETS_SPREADSHEET_ID` as an
   encrypted secret. The existing `GOOGLE_SERVICE_ACCOUNT_JSON` secret can be
   reused if it is already configured for Calendar; otherwise add the complete
   service-account JSON as an encrypted secret too.
6. Push the Worker and website changes to `main`. GitHub Actions deploys the
   Worker when `cloudflare/` changes and deploys the static site on every push;
   confirm both workflows succeed. The Worker uses the Sheets API with the
   service account, and its existing Razorpay credentials verify that the
   submitted payment is captured and belongs to the booking.
7. Test with a Razorpay Test Mode payment, fill in and submit the thank-you
   form, and verify that one row appears under the `Customers` header row.
   Confirm that retries for the same payment do not add another row.

The sheet stores customer contact details, date of birth, and birth place.
Restrict spreadsheet sharing to staff who need it. Failed Sheets writes leave
the form available for retry; the payment ID check prevents retries from
creating duplicate rows.

## Google Calendar appointments

After the thank-you form and Sheets submission succeed, the page sends
completed customer details to Splitforms and then asks the Worker to create
one event in the configured calendar. The event includes the customer name,
mobile number, plan, selected analysis, discussion topics, and payment
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
  `calendar.events` scope; Sheets appends recheck payment ownership and use the
  `spreadsheets` scope.
- Rotate/revoke any Razorpay key that has ever been committed or shared.
- Configure a Cloudflare rate-limiting rule for
  `api.astrojak.in/create-order`, `api.astrojak.in/verify-payment`, and
  `api.astrojak.in/create-calendar-event`, and
  `api.astrojak.in/append-customer-details` before enabling live payments.

## Local checks

```sh
node --check cloudflare/worker.mjs
```
