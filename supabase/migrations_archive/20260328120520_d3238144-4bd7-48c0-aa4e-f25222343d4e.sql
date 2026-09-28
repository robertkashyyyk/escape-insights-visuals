ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_payout numeric;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_fees numeric;
ALTER TABLE reservations ADD CONSTRAINT reservations_listing_checkin_guest_unique UNIQUE (listing_id, check_in, guest_name);