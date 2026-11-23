/* =====================================================================
   ASTROJAK PRICING: THE ONE PLACE TO CHANGE PRICES
   ---------------------------------------------------------------------
   Change a number below, save, and push to GitHub. The website uses this file,
   and the Cloudflare payment Worker imports the same plans for server-side prices.
   GitHub Actions redeploys the Worker when this file changes:
     1. every price on the website updates (home page, booking page,
        comparison table, buttons, thank-you page)
     2. the selected gateway order is created with the new amount
   Only edit the numbers (and names if you want). Keep existing plan ids
   stable; new plan ids must also be added to the payment Worker.
   ===================================================================== */
var PRICING = {
  symbol: '₹',
  plans: {
    'reserve':          { name: 'Reserve Your Slot',             price: 299,  listPrice: 429  },
    'kundali':          { name: 'Kundali Analysis',              price: 999,  listPrice: 1499 },
    'detailed-kundali': { name: 'Detailed Kundali Analysis',     price: 1499, listPrice: 2299 },
    'matchmaking':      { name: 'Marriage Matchmaking Analysis', price: 1999, listPrice: 2999 },
    'five-year-roadmap':{ name: '5-Year Roadmap',                price: 2999, listPrice: 4499 }
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = PRICING;
