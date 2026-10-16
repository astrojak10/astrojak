# Razorpay payment API on Cloudflare Workers

The website is static on GitHub Pages. This Worker creates Razorpay payment
links without exposing Razorpay credentials to visitors or the GitHub Pages
build.

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
6. Confirm `https://api.astrojak.in/create-payment-link` is live. The API URL
   is configured in `pay.js`; if your API hostname differs, update that URL.
7. Test a payment in Razorpay Test Mode and confirm the successful callback
   returns to `https://www.astrojak.in/thank-you.html`.

## Security notes

- The browser submits a plan identifier; the Worker uses the server-side
  `pricing.js` plan data. It does not accept a client-supplied amount. A change
  to `pricing.js` triggers both the static-site and Worker deployments.
- Only the listed website origins and the local development origin are allowed
  by CORS. CORS is not authentication; the server-side plan/amount validation
  is still required.
- The Worker returns only the payment URL/reference and does not return or log
  credentials. Razorpay failure details are deliberately not exposed.
- Rotate/revoke any Razorpay key that has ever been committed or shared.
- Configure a Cloudflare rate-limiting rule for
  `api.astrojak.in/create-payment-link` before enabling live payments.

## Local checks

```sh
node --check cloudflare/worker.mjs
```
