# Supabase setup

Apply `supabase/migrations/202610020001_security_and_favorites.sql` once in your Supabase project. The app needs its existing public Supabase variables and `SUPABASE_SERVICE_ROLE_KEY` on the server for username login. Never expose the service role key to the browser.

In Auth settings, allow your site's `/auth/callback` and `/auth/callback?recovery=1` redirect URLs. Configure SMTP and the email OTP template to include `{{ .Token }}` so users can enter their code. Configure a Supabase-supported SMS provider and enable phone authentication for phone-change codes. Supabase handles OTP expiry and sending limits; configure auth rate limits and production bot protection for your deployment.

Registration stores the phone as contact metadata. The Security page registers it again and verifies either the email or phone through Supabase Auth. Email verification does not mark the phone as verified.

Identity photos are in the private `identity-documents` bucket, never in public profiles. Submissions start pending; users cannot approve their own submissions. An authorized operator must review submissions through a trusted admin environment before setting status to approved. This release does not automate document authenticity checks or require approval to buy/sell. Define retention and deletion procedures for this private data before production use.

Manual “Marcar como vendido” handles sales outside the app. The database function locks the product and refuses changes for products with non-cancelled/non-refunded orders. Paid app orders continue through the existing sales flow.
