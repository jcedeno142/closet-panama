# Direct buyer–seller sales

The app currently runs with `managedPaymentsEnabled = false` in `lib/marketplace-mode.ts`.
Listings, offers/counteroffers and messaging stay available. Contacting a seller opens a conversation. Accepting an offer does not reserve the product or confirm payment.

Apply `supabase/migrations/202610120001_direct_sales.sql` once in the Supabase SQL editor. The new table stores only the seller's acknowledgment of externally received payment. It does not represent funds held by Closet or independently verified payment.

In the conversation, the seller chooses their active listing, enters the final agreed USD amount, and explicitly confirms receipt from the other participant. The database checks the authenticated seller, conversation membership, amount and listing availability in a transaction. It records the buyer from the conversation, marks the item sold and returns the same sale for identical retries. Participants can read the record; neither can edit or delete it through the client.

The buyer sees the record under My purchases, and the seller under My sales. Both can return to the conversation to arrange delivery themselves. The conversation refreshes confirmations every 15 seconds while visible. No wallet balance, commission, transfer, shipping label or delivery assignment is created.

The previous checkout/payment/delivery APIs return 409 in this mode, including the test-payment endpoint. Old checkout, wallet, driver and review URLs explain direct sales instead of exposing managed payment controls. Existing order/payment records are preserved. Listings associated with previously paid or otherwise active managed orders cannot be confirmed as direct sales until those old orders are resolved.

Validation on a test account after migration:
1. Buyer contacts a seller, negotiates an offer, and opens the conversation from the accepted offer.
2. Seller selects a listing, enters the agreed amount and confirms receipt. Both participants see the same amount and seller-reported confirmation.
3. The listing disappears from active search and appears in Vendidos; the record appears in purchases/sales.
4. An unrelated user cannot read the sale; a buyer cannot confirm payment for someone else's listing; duplicate or competing confirmations cannot produce multiple sales.
5. Old checkout and delivery routes do not accept payments or change orders.

Real external payments and fulfillment occur between the users; test with agreed dummy transactions rather than sending real money during validation.
