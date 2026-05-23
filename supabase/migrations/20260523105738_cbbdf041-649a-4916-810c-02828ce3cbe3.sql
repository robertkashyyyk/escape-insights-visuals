
-- Ensure app_settings.key is unique so upserts work cleanly
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_unique ON public.app_settings (key);

-- Seed the cleaner notification toggle as disabled
INSERT INTO public.app_settings (key, value)
VALUES ('cleaner_email_notifications_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
