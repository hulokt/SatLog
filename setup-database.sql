-- SAT Master Log Database Setup
-- Run this in your Supabase SQL Editor

-- First, drop existing functions if they exist to ensure clean setup
DROP FUNCTION IF EXISTS upsert_user_data(UUID, VARCHAR(50), JSONB);
DROP FUNCTION IF EXISTS get_user_data(UUID, VARCHAR(50));
DROP FUNCTION IF EXISTS delete_user_data(UUID, VARCHAR(50));
DROP FUNCTION IF EXISTS get_all_user_data(UUID);

-- Create user_data table to store all localStorage data
CREATE TABLE IF NOT EXISTS user_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, data_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_type ON user_data(data_type);
CREATE INDEX IF NOT EXISTS idx_user_data_updated_at ON user_data(updated_at);

-- Create RLS policies for user_data table
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own data" ON user_data;
DROP POLICY IF EXISTS "Users can insert own data" ON user_data;
DROP POLICY IF EXISTS "Users can update own data" ON user_data;
DROP POLICY IF EXISTS "Users can delete own data" ON user_data;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON user_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON user_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON user_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON user_data
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_data_updated_at ON user_data;
CREATE TRIGGER update_user_data_updated_at
    BEFORE UPDATE ON user_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to upsert user data
CREATE OR REPLACE FUNCTION upsert_user_data(
    p_user_id UUID,
    p_data_type VARCHAR(50),
    p_data JSONB
)
RETURNS user_data AS $$
DECLARE
    result user_data;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'upsert_user_data called with user_id: %, data_type: %', p_user_id, p_data_type;
    
    INSERT INTO user_data (user_id, data_type, data)
    VALUES (p_user_id, p_data_type, p_data)
    ON CONFLICT (user_id, data_type)
    DO UPDATE SET 
        data = EXCLUDED.data,
        updated_at = NOW()
    RETURNING * INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in upsert_user_data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user data by type
CREATE OR REPLACE FUNCTION get_user_data(
    p_user_id UUID,
    p_data_type VARCHAR(50)
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'get_user_data called with user_id: %, data_type: %', p_user_id, p_data_type;
    
    SELECT data INTO result
    FROM user_data
    WHERE user_id = p_user_id AND data_type = p_data_type;
    
    RETURN COALESCE(result, '{}'::JSONB);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in get_user_data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete user data by type
CREATE OR REPLACE FUNCTION delete_user_data(
    p_user_id UUID,
    p_data_type VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'delete_user_data called with user_id: %, data_type: %', p_user_id, p_data_type;
    
    DELETE FROM user_data
    WHERE user_id = p_user_id AND data_type = p_data_type;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count > 0;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in delete_user_data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all user data types
CREATE OR REPLACE FUNCTION get_all_user_data(p_user_id UUID)
RETURNS TABLE(data_type VARCHAR(50), data JSONB, updated_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    -- Log the function call for debugging
    RAISE NOTICE 'get_all_user_data called with user_id: %', p_user_id;
    
    RETURN QUERY
    SELECT ud.data_type, ud.data, ud.updated_at
    FROM user_data ud
    WHERE ud.user_id = p_user_id
    ORDER BY ud.updated_at DESC;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in get_all_user_data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_data TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_data(UUID, VARCHAR(50), JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_data(UUID, VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_data(UUID, VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_user_data(UUID) TO authenticated;

-- Test the functions to ensure they work
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000';
    test_result JSONB;
    test_upsert user_data;
BEGIN
    -- Test get_user_data
    SELECT get_user_data(test_user_id, 'test') INTO test_result;
    RAISE NOTICE 'Test get_user_data result: %', test_result;
    
    -- Test upsert_user_data
    SELECT upsert_user_data(test_user_id, 'test', '{"test": true}'::JSONB) INTO test_upsert;
    RAISE NOTICE 'Test upsert_user_data result: %', test_upsert;
    
    -- Clean up test data
    PERFORM delete_user_data(test_user_id, 'test');
    
    RAISE NOTICE 'All function tests completed successfully!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Function test failed: %', SQLERRM;
END
$$;

-- Verify the setup
SELECT 'Database setup completed successfully!' as status; 

-- Show created functions for verification
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('upsert_user_data', 'get_user_data', 'delete_user_data', 'get_all_user_data')
ORDER BY proname; 