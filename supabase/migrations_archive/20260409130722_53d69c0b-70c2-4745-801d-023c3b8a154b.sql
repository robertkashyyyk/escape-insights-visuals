-- Set all owners to 20% + VAT
UPDATE public.property_owners 
SET management_rate_pct = 20, vat_inclusive = true 
WHERE management_rate_pct IS NULL;