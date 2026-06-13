import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  supabaseUrl || 'https://dummy-project.supabase.co', 
  supabaseAnonKey || 'dummy-key'
);

/**
 * Authentication with Supabase
 */
export const signInWithGoogle = async () => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) console.error("Error signing in with Google via Supabase:", error.message);
};

export const logOut = async () => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Error signing out from Supabase:", error.message);
};

/**
 * Sync logic with Supabase. 
 * Please ensure you have a table named `dps_data` in your Supabase project.
 */

export const subscribeToData = (userId: string, onUpdate: (data: any) => void, onError?: () => void) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (onError) onError();
    return () => {};
  }

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
          onUpdate((payload.new as any).data); // Assuming we store the state object in a 'data' jsonb column
        }
      }
    )
    .subscribe();

  // Initial fetch
  fetchData(userId).then(data => {
    if (data) {
      onUpdate(data);
    } else if (onError) {
      onError();
    }
  }).catch(() => {
    if (onError) onError();
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

// --- DUMMY IMPLEMENTATIONS FOR SHIMS ---
export const saveTopic = async (...args: any[]) => {};
export const deleteStudent = async (...args: any[]) => {};
export const saveStudent = async (...args: any[]) => {};
export const deleteTopic = async (...args: any[]) => {};
export const saveTopicsBulk = async (...args: any[]) => {};
export const saveAttendance = async (...args: any[]) => {};
export const saveDailyNote = async (...args: any[]) => {};
export const saveHabitCompletionBulk = async (...args: any[]) => {};
export const saveHabitList = async (...args: any[]) => {};
export const deleteHabit = async (...args: any[]) => {};
export const saveHabitCompletion = async (...args: any[]) => {};
export const saveJournalEntry = async (...args: any[]) => {};
export const saveExpense = async (...args: any[]) => {};
export const getSharedNote = async (...args: any[]) => null;
export const createSharedNote = async (...args: any[]) => "dummy-share-id";
export const getCloudBackups = async (...args: any[]) => [];
export const createCloudBackup = async (...args: any[]) => {};
export const getSyncStatus = () => true;
