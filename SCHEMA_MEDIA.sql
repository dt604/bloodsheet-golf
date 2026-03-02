-- Create match_media table
CREATE TABLE public.match_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    context TEXT, -- e.g., 'snake', 'sandie', 'greenie', or null
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.match_media ENABLE ROW LEVEL SECURITY;

-- Create policies for match_media
-- Anyone can read media for a match they are part of
CREATE POLICY "Users can view media for their matches"
    ON public.match_media
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.match_players mp
            WHERE mp.match_id = match_media.match_id
            AND mp.user_id = auth.uid()
        )
    );

-- Participants can insert media for a match they are part of
CREATE POLICY "Users can insert media for their matches"
    ON public.match_media
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.match_players mp
            WHERE mp.match_id = match_media.match_id
            AND mp.user_id = auth.uid()
        )
        AND uploader_id = auth.uid()
    );

-- Allow users to delete their own uploaded media
CREATE POLICY "Users can delete their own media"
    ON public.match_media
    FOR DELETE
    USING (uploader_id = auth.uid());


-- Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public) VALUES ('match-media', 'match-media', true);

-- Storage Policies for 'match-media' bucket
-- Allow public read access to the match-media bucket
CREATE POLICY "Public Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'match-media');

-- Allow authenticated users to upload to match-media bucket
CREATE POLICY "Authenticated users can upload media"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'match-media' 
        AND auth.role() = 'authenticated'
    );

-- Allow users to delete their own media uploads
CREATE POLICY "Users can delete own media"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'match-media' 
        AND auth.uid() = owner
    );
