-- TouchStay → property_knowledge import (30 properties)
-- Generated from touchstay_parsed.json — placeholder/heading-only blocks filtered out

-- 5 Morelli Plaza
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE '5 Morelli Plaza' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Local Area\nThe Cliff Walk: The Portstewart Cliff Walk starts at the old convent, now a local high school, and ends at Portstewart Strand. Easy walk, popular for running and sea swimming spots; Lost & Found Coffee shop along the route.\nPortstewart Strand: Two-mile beach with golden sand and tall dunes; activities include walking, surfing, horse-riding, bird watching; managed by National Trust; Blue Flag awarded; Harry''s Shack restaurant available; extensive walks among sand dunes with views of the River Bann.\nCauseway Coast Way: Long-distance walking route along Northern Ireland''s north coast; local section ''Port Path'' (about 6 miles) between Portstewart and Portrush; varied path conditions; panoramic coastal views; starts at old convent in Portstewart; passes Harbour Hill and cliff tops, includes several sets of steps, connects the two towns.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE '5 Morelli Plaza' LIMIT 1);

-- 60 Lough Erne Golf Village
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE '60 Lough Erne Golf Village' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET access_notes = COALESCE(NULLIF(pk.access_notes,''), E'**Key safe code**\nWe will provide you with an access key code on the morning of your arrival which is sent by email.\n\n**Check-in instructions**\nThe key to the door is in a Smart Key Box which is positioned alongside the door. Please ensure you have the code before you travel. If not, please contact us.'), general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Local Area\nIf you are arriving early without prior arrangement, have a look at the Local Area Guide section where you will find local grocery stores or somewhere to explore in the local area for an hour or two.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE '60 Lough Erne Golf Village' LIMIT 1);

-- Bryan Street Apartments
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE 'Bryan Street Apartments' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET access_notes = COALESCE(NULLIF(pk.access_notes,''), E'**Door code**\nTo operate the Yale Smart Lock at the front door, place your palm over the keypad so the numbers light up. Then enter your passcode followed by * and turn the knob on the smart lock. Alternatively, the apartment is fitted with an IglooHome smart lock: touch the lock to activate it, enter your PIN code followed by the unlock symbol.\n\n**Check-in instructions**\nCheck-in time is 4pm. Early check-in may be arranged at an additional charge by contacting the host. If arriving early without prior arrangement, refer to the Local Area Guide to explore local grocery stores or the area.'), general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Local Area\nThere are local grocery stores and places to explore nearby for early arrivals. Frequent buses leave the combined train and bus station to the town centre, which is a short walk from the apartment. Ask at the station for bus timetables.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE 'Bryan Street Apartments' LIMIT 1);

-- Escape Ordinary at Lough Erne Golf Village - No.32
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE 'Escape Ordinary at Lough Erne Golf Village - No.32' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET access_notes = COALESCE(NULLIF(pk.access_notes,''), E'**Key safe code**\nWill be provided by email on the morning of your arrival.\n\n**Door code**\nWill be provided by email on the morning of your arrival.\n\n**Check-in instructions**\nThe key to the door is in a Smart Key Box positioned alongside the door. You will receive an access key code by email on the morning of your arrival to check yourself in. Please ensure you have the code before you travel. Check-in time is 4pm. Early check-in may be arranged for an additional charge with prior contact.'), general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Checkout\nCheck out is by 11am.\n\n### Local Area\nLocal grocery stores and places to explore are listed in the Local Area Guide section. Recommendations include excellent restaurants, coffee shops, casual dining, shopping in Enniskillen and Omagh, walking and hiking routes, pet friendly locations and services.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE 'Escape Ordinary at Lough Erne Golf Village - No.32' LIMIT 1);

-- Bayview Apartments
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE 'Bayview Apartments' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Local Area\nGetting Around, Grocery Shopping, Restaurants, Coffee Shop / Casual Dining Recommendations, Things to do in the area, Shopping in Larne, Walking and Hiking, Recommended walks.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE 'Bayview Apartments' LIMIT 1);

-- Escape Ordinary at Castle Hume
INSERT INTO property_knowledge (listing_id) SELECT id FROM listings WHERE name ILIKE 'Escape Ordinary at Castle Hume' AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;
UPDATE property_knowledge pk SET general_notes = CASE WHEN pk.general_notes IS NULL OR pk.general_notes = '' THEN E'### Local Area\nGetting Around, Grocery Shopping, Restaurants, Coffee Shop / Casual Dining Recommendations, Things to do in the area, Shopping in Enniskillen, Shopping in Omagh, Walking and Hiking, Recommended walks, Enniskillen Pet Friendly Locations, Picking up after your pup, Pet services.' ELSE pk.general_notes END WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE 'Escape Ordinary at Castle Hume' LIMIT 1);

-- Castle Hume cluster (No.2, 5, 6, 11, 12, 14, 16, 18, 19, 23) — generic local area summary
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'Escape Ordinary at Castle Hume No.2',
    'Escape Ordinary at Castle Hume No.5',
    'Escape Ordinary at Castle Hume No.6',
    'Escape Ordinary at Castle Hume No.11',
    'Escape Ordinary at Castle Hume No.12',
    'Escape Ordinary at Castle Hume No.14',
    'Escape Ordinary at Castle Hume No.16',
    'Escape Ordinary at Castle Hume No.18',
    'Escape Ordinary at Castle Hume No.19',
    'Escape Ordinary at Castle Hume No.23'
  ] LOOP
    INSERT INTO property_knowledge (listing_id)
    SELECT id FROM listings WHERE name ILIKE n AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;

    UPDATE property_knowledge pk
    SET general_notes = CASE
      WHEN pk.general_notes IS NULL OR pk.general_notes = ''
        THEN E'### Local Area\nLocal recommendations: excellent restaurants, great coffee, casual dining, grocery shopping, things to do in the area, shopping in Enniskillen and Omagh, walking and hiking, recommended walks, Enniskillen pet-friendly locations and services.'
      ELSE pk.general_notes
    END
    WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE n LIMIT 1);
  END LOOP;
END $$;

-- Belfast properties — generic Belfast local area summary
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'Escape Ordinary in Belfast',
    'Lesley Court No.2'
  ] LOOP
    INSERT INTO property_knowledge (listing_id)
    SELECT id FROM listings WHERE name ILIKE n AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;

    UPDATE property_knowledge pk
    SET general_notes = CASE
      WHEN pk.general_notes IS NULL OR pk.general_notes = ''
        THEN E'### Local Area\nGetting Around, Grocery Shopping, Belfast City Centre Restaurants, Botanic Area Restaurants, Lisburn Road Area Restaurants, Cathedral Quarter Restaurants, Coffee Shop / Casual Dining Recommendations, Things to do in the area, Shopping in Belfast, Walking and Hiking, Recommended Walks.'
      ELSE pk.general_notes
    END
    WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE n LIMIT 1);
  END LOOP;
END $$;

-- Lough Erne Golf Village + Devenish + Mabel + Lilly + Enterprise + Metropole — Fermanagh local area
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'Lough Erne Golf Village No.20',
    'Escape Ordinary at Devenish Manor',
    'Mabel''s Maison by Escape Ordinary',
    'Lilly''s Pad & Ernie''s Den',
    'Enterprise Escape by Escape Ordinary',
    'Metropole Lodge by Escape Ordinary'
  ] LOOP
    INSERT INTO property_knowledge (listing_id)
    SELECT id FROM listings WHERE name ILIKE n AND NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = listings.id) LIMIT 1;

    UPDATE property_knowledge pk
    SET general_notes = CASE
      WHEN pk.general_notes IS NULL OR pk.general_notes = ''
        THEN E'### Local Area\nLocal recommendations: excellent restaurants, coffee shops, casual dining, grocery shopping, things to do in the area, shopping in Enniskillen and Omagh, walking and hiking, recommended walks, pet-friendly locations and services.'
      ELSE pk.general_notes
    END
    WHERE pk.listing_id = (SELECT id FROM listings WHERE name ILIKE n LIMIT 1);
  END LOOP;
END $$;

-- Mark the import batch
INSERT INTO upload_batches (file_name, row_count, status)
VALUES ('touchstay_parsed.json (batch 2)', 30, 'completed');