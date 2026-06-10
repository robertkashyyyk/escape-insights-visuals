-- Add Stripe as an OTA ingestion platform (direct/website/google card payments).
alter type ota_platform add value if not exists 'stripe';
