
CREATE TYPE public.player_type AS ENUM ('slots', 'table', 'mix');

ALTER TABLE public.players ADD COLUMN player_type public.player_type NOT NULL DEFAULT 'table';
