-- Helper: ensure a property_knowledge row exists for every listing we're about to update
INSERT INTO property_knowledge (listing_id)
SELECT l.id FROM listings l
WHERE NOT EXISTS (SELECT 1 FROM property_knowledge pk WHERE pk.listing_id = l.id);

-- =================== ACCESS NOTES (real codes / instructions) ===================

-- Bryan Street properties (smart lock instructions)
UPDATE property_knowledge pk SET access_notes = COALESCE(NULLIF(pk.access_notes,''),
  E'**Door code**\nTo operate the Yale Smart Lock at the front door, place your palm over the keypad so the numbers light up. Then enter your passcode followed by * and turn the knob on the smart lock. Alternatively, the apartment is fitted with an IglooHome smart lock: touch the lock to activate it, enter your PIN code followed by the unlock symbol.\n\n**Check-in instructions**\nCheck-in time is 4pm. Early check-in may be arranged at an additional charge by contacting the host.')
FROM listings l WHERE pk.listing_id = l.id AND l.name ILIKE '%Bryan Street%';

-- Lough Erne Golf Village (Smart Key Box)
UPDATE property_knowledge pk SET access_notes = COALESCE(NULLIF(pk.access_notes,''),
  E'**Key safe code**\nWill be provided by email on the morning of your arrival.\n\n**Check-in instructions**\nThe key to the door is in a Smart Key Box positioned alongside the door. You will receive an access key code by email on the morning of your arrival to check yourself in. Please ensure you have the code before you travel. Check-in time is 4pm. Early check-in may be arranged for an additional charge with prior contact.')
FROM listings l WHERE pk.listing_id = l.id AND l.name ILIKE '%Lough Erne Golf Village%';

-- =================== GENERAL NOTES — Local Area summaries by region ===================

-- Belfast cluster (5 properties)
UPDATE property_knowledge pk SET general_notes = COALESCE(NULLIF(pk.general_notes,''),
  E'### Local Area\nGetting Around, Grocery Shopping, Belfast City Centre Restaurants, Botanic Area Restaurants, Lisburn Road Area Restaurants, Cathedral Quarter Restaurants, Coffee Shop / Casual Dining Recommendations, Things to do in the area, Shopping in Belfast, Walking and Hiking, Recommended Walks.')
FROM listings l WHERE pk.listing_id = l.id AND (
  l.name ILIKE '%Malone Place%' OR
  l.name ILIKE '%Bryan Street%' OR
  l.name ILIKE '%Belfast%' OR
  l.name ILIKE '%University Road%'
);

-- North Coast (Portstewart / Bushmills / Ballycastle / Larne)
UPDATE property_knowledge pk SET general_notes = COALESCE(NULLIF(pk.general_notes,''),
  E'### Local Area\n**The Cliff Walk** — starts at the old convent (now a high school) and ends at Portstewart Strand. Easy walk, popular for running and sea swimming. Lost & Found Coffee shop along the route.\n\n**Portstewart Strand** — Two-mile beach with golden sand and tall dunes; managed by National Trust; Blue Flag awarded; Harry''s Shack restaurant available.\n\n**Causeway Coast Way** — Long-distance walking route along the north coast; the local "Port Path" section (about 6 miles) connects Portstewart and Portrush.\n\n**Nearby attractions**: Giant''s Causeway, Old Bushmills Distillery, Dunluce Castle, Carrick-a-Rede Rope Bridge, Dark Hedges.')
FROM listings l WHERE pk.listing_id = l.id AND (
  l.name ILIKE '%Morelli Plaza%' OR
  l.name ILIKE '%Bayview%' OR
  l.name ILIKE '%Distillers View%' OR
  l.name ILIKE '%Manse Ballycastle%' OR
  l.name ILIKE '%Harbour Heights%'
);

-- Fermanagh — Castle Hume cluster (12 properties)
UPDATE property_knowledge pk SET general_notes = COALESCE(NULLIF(pk.general_notes,''),
  E'### Local Area\nLocal recommendations: excellent restaurants in Enniskillen (Dollakis, The Belfry, Francos, Lakelands at Lough Erne Resort), great coffee, casual dining, grocery shopping (Tesco, Aldi, Lidl, SuperValu in Enniskillen), shopping in Enniskillen and Omagh, walking and hiking (Cuilcagh Mountain Boardwalk, Belmore Forest, Castle Archdale), recommended walks, Enniskillen pet-friendly locations and services.\n\n**Nearby attractions**: Marble Arch Caves, Florence Court, Devenish Island, Enniskillen Castle, Castle Hume Golf Club, Lough Erne Golf Resort.')
FROM listings l WHERE pk.listing_id = l.id AND (
  l.name ILIKE '%Castle Hume%' OR
  l.name ILIKE '%Lough Erne Golf Village%' OR
  l.name ILIKE '%Devenish Manor%' OR
  l.name ILIKE '%Mabel%' OR
  l.name ILIKE '%Metropole Lodge%' OR
  l.name ILIKE '%Enterprise Escape%' OR
  l.name ILIKE '%Lily%' OR
  l.name ILIKE '%Ernie%' OR
  l.name ILIKE '%Loughside Lodge%' OR
  l.name ILIKE '%Cherry Lodge%' OR
  l.name ILIKE '%Cappaghmore%' OR
  l.name ILIKE '%Ellie%' OR
  l.name ILIKE '%Green Gables%' OR
  l.name ILIKE '%Lookout%' OR
  l.name ILIKE '%Turner%' OR
  l.name ILIKE '%Northern Bank House%' OR
  l.name ILIKE '%Escape Ordinary in Enniskillen%'
);

-- Mark the import batch
INSERT INTO upload_batches (file_name, row_count, status)
VALUES ('touchstay_parsed.json (corrected match)', 0, 'completed');