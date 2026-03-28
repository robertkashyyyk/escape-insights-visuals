
-- Migration 1: Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration 2: User roles
CREATE TYPE public.app_role AS ENUM ('super', 'senior', 'admin', 'client');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS for user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super users can read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super'));

CREATE POLICY "Super users can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super'));

CREATE POLICY "Super users can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super'));

-- Migration 3: Core tables
CREATE TABLE public.property_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.property_owners(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  country text,
  property_type text,
  bedrooms integer,
  bathrooms integer,
  max_guests integer,
  nightly_rate numeric(10,2),
  status text NOT NULL DEFAULT 'active',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  guest_name text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  total_amount numeric(10,2),
  platform text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  row_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for property_owners
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior/Admin can read all owners"
  ON public.property_owners FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clients can read own owner record"
  ON public.property_owners FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super/Senior can insert owners"
  ON public.property_owners FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

CREATE POLICY "Super/Senior can update owners"
  ON public.property_owners FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

CREATE POLICY "Super can delete owners"
  ON public.property_owners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super'));

-- RLS for listings
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior/Admin can read all listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clients can read own listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.property_owners
      WHERE property_owners.id = listings.owner_id
        AND property_owners.user_id = auth.uid()
    )
  );

CREATE POLICY "Super/Senior can insert listings"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

CREATE POLICY "Super/Senior can update listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

CREATE POLICY "Super can delete listings"
  ON public.listings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super'));

-- RLS for reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior/Admin can read all reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clients can read own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      JOIN public.property_owners ON property_owners.id = listings.owner_id
      WHERE listings.id = reservations.listing_id
        AND property_owners.user_id = auth.uid()
    )
  );

CREATE POLICY "Super/Senior can insert reservations"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

CREATE POLICY "Super/Senior can update reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );

-- RLS for upload_batches
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior can manage upload_batches"
  ON public.upload_batches FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super') OR
    public.has_role(auth.uid(), 'senior')
  );
