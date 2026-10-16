/* =====================================================================
   ASTROJAK PRICING: THE ONE PLACE TO CHANGE PRICES
   ---------------------------------------------------------------------
   Change a number below, save, and push to GitHub. After Netlify
   redeploys (about a minute):
     1. every price on the website updates (home page, booking page,
        comparison table, buttons, thank-you page)
     2. the Razorpay payment link is created with the new amount
   Only edit the numbers (and names if you want). Keep the plan ids
   (reserve, kundali, detailed-kundali, matchmaking) exactly as they are.
   ===================================================================== */
var PRICING = {
  symbol: '₹',
  plans: {
    'reserve':          { name: 'Reserve Your Slot',             price: 101,  listPrice: 499  },
    'kundali':          { name: 'Kundali Analysis',              price: 999,  listPrice: 4999 },
    'detailed-kundali': { name: 'Detailed Kundali Analysis',     price: 1499, listPrice: 9999 },
    'matchmaking':      { name: 'Marriage Matchmaking Analysis', price: 1499, listPrice: 9999 }
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = PRICING;
