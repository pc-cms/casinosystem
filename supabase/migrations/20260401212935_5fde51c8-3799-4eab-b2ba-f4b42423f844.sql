
-- Add player_category enum
CREATE TYPE public.player_category AS ENUM ('diamond', 'platinum', 'gold', 'guest');

-- Add category column to players table
ALTER TABLE public.players ADD COLUMN category public.player_category NOT NULL DEFAULT 'guest';

-- Add note_type column to player_notes table
ALTER TABLE public.player_notes ADD COLUMN note_type text NOT NULL DEFAULT 'info';
