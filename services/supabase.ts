import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Sync logic with Supabase. 
 * Please ensure you have a table named `dps_data` in your Supabase project.
 */

export const subscribeToData = (userId: string, onUpdate: (data: any) => void) => {
  if (!supabaseUrl || !supabaseAnonKey) return () => {};

  // Subscribe to realtime changes on the 'dps_data' table for the current user
  const subscription = supabase
    .channel('dps_data_changes')
    .on(
      'postgres_changes',
      {
        event: '*', 
        schema: 'public', 
        table: 'dps_data',
        filter: `owner_id=eq.${userId}`
      },
      (payload) => {
        console.log('Realtime update received:', payload);
        if (payload.new) {
          onUpdate(payload.new.data); // Assuming we store the state object in a 'data' jsonb column
        }
      }
    )
    .subscribe();

  // Initial fetch
  fetchData(userId).then(data => {
    if (data) onUpdate(data);
  });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(subscription);
  };
};

export const fetchData = async (userId: string) => {
  try {
    const { data: record, error } = await supabase
      .from('dps_data')
      .select('data')
      .eq('owner_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching data from Supabase:", error);
      return null;
    }
    return record?.data || null;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
};

export const saveData = async (userId: string, dataState: any) => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const { error } = await supabase
      .from('dps_data')
      .upsert({ 
        owner_id: userId, 
        data: dataState,
        updated_at: new Date().toISOString()
      }, { onConflict: 'owner_id' });

    if (error) {
      console.error("Error saving data to Supabase:", error);
    }
  } catch (error) {
    console.error("Error writing data to Supabase:", error);
  }
};
