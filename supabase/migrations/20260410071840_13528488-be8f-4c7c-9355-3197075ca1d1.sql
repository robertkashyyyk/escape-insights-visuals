
-- Create conversation history table for Orin chat
CREATE TABLE public.orin_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  current_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orin_conversations ENABLE ROW LEVEL SECURITY;

-- Users can read their own conversations
CREATE POLICY "Users can read own conversations"
  ON public.orin_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own messages
CREATE POLICY "Users can insert own messages"
  ON public.orin_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own messages (clear conversation)
CREATE POLICY "Users can delete own messages"
  ON public.orin_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Super/Senior can read all conversations (for monitoring)
CREATE POLICY "Super/Senior can read all conversations"
  ON public.orin_conversations
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

-- Index for fast user-scoped queries
CREATE INDEX idx_orin_conversations_user_id ON public.orin_conversations (user_id, created_at DESC);
