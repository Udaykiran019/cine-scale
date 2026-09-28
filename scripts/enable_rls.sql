-- Enable Row Level Security on movies table
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

-- Create policy permitting anonymous SELECT operations only
CREATE POLICY "Allow anonymous select"
ON movies
FOR SELECT
TO anon
USING (true);
