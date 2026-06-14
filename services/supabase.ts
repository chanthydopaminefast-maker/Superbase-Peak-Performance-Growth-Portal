import { createClient } from '@supabase/supabase-js';

// @ts-ignore
let supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL || '';
if (supabaseUrlRaw) {
  if (!supabaseUrlRaw.startsWith('http')) {
    supabaseUrlRaw = `https://${supabaseUrlRaw}`;
  }
  // Strip trailing slashes and common accidental path additions like /rest/v1
  supabaseUrlRaw = supabaseUrlRaw.replace(/\/+$/, '');
  if (supabaseUrlRaw.endsWith('/rest/v1')) {
    supabaseUrlRaw = supabaseUrlRaw.replace(/\/rest\/v1$/, '');
  }
}
const supabaseUrl = supabaseUrlRaw || undefined;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  supabaseUrl || 'https://kugvbcwrjzoxkabpjvcr.supabase.co', 
  supabaseAnonKey || 'dummy-key'
);

export const getSupabaseProjectId = () => {
  if (!supabaseUrl || supabaseUrl.includes('dummy')) return 'kugvbcwrjzoxkabpjvcr'; 
  try {
    const urlObj = new URL(supabaseUrl);
    const hostname = urlObj.hostname;
    if (hostname.endsWith('.supabase.co')) {
      return hostname.split('.')[0];
    }
  } catch (e) {
    const match = supabaseUrl.match(/(?:https?:\/\/)?([^.]+)\.supabase\.(?:co|net)/);
    if (match) return match[1];
  }
  return 'kugvbcwrjzoxkabpjvcr';
};

export const getSupabaseAuthProvidersUrl = () => {
  const proj = getSupabaseProjectId();
  return `https://supabase.com/dashboard/project/${proj}/auth/providers`;
};

/**
 * Authentication with Supabase
 */
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
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

export const uploadFile = async (userId: string, file: File): Promise<string | null> => {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);

    if (error) {
       // If bucket doesn't exist, try to create it? No, client cannot create buckets.
       // We'll just log it.
       console.error("Supabase Storage error:", error.message);
       return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error("File upload failed:", err);
    return null;
  }
};

export const deleteFile = async (path: string) => {
  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const filePath = path.split('/storage/v1/object/public/attachments/')[1];
    if (filePath) {
      await supabase.storage.from('attachments').remove([filePath]);
    }
  } catch (err) {}
};

export const saveTopic = async (userId: string, topic: any, category: string) => {
  // If we had a topics table, we'd sync it here. 
  // For now, App.tsx calls saveData which handles the whole blob.
  // We keep this shim for compatibility and potentially future logic.
};

export const deleteStudent = async (userId: string, studentId: string) => {};
export const saveStudent = async (userId: string, student: any) => {};
export const deleteTopic = async (userId: string, topicId: string, category: string) => {};
export const saveTopicsBulk = async (userId: string, ...args: any[]) => {};
export const saveAttendance = async (userId: string, ...args: any[]) => {};
export const saveDailyNote = async (userId: string, date: string, content: string) => {};
export const saveHabitCompletionBulk = async (userId: string, date: string, completions: any) => {};
export const saveHabitList = async (userId: string, habits: any[]) => {};
export const deleteHabit = async (userId: string, habitId: string) => {};
export const saveHabitCompletion = async (userId: string, date: string, habitId: string, value: any) => {};
export const saveJournalEntry = async (userId: string, date: string, entry: any) => {};
export const saveExpense = async (userId: string, expense: any, isDelete: boolean) => {};
export const getSharedNote = async (shareId: string) => {
  try {
    const { data, error } = await supabase
      .from('dps_shares')
      .select('*')
      .eq('id', shareId)
      .single();
    if (error) return null;
    return data;
  } catch (e) { return null; }
};

export const createSharedNote = async (userId: string, ownerName: string, type: string, title: string, payload: any) => {
  try {
    const id = Math.random().toString(36).substring(2, 12);
    const { error } = await supabase
      .from('dps_shares')
      .insert({
        id,
        owner_id: userId,
        owner_name: ownerName,
        type,
        title,
        payload,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
    return id;
  } catch (e) {
    throw e;
  }
};

export const getCloudBackups = async (userId: string) => [];
export const createCloudBackup = async (userId: string, data: any) => {};
export const getSyncStatus = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return false;
    try {
        const { data, error } = await supabase.from('dps_data').select('count', { count: 'exact', head: true }).limit(1);
        return !error;
    } catch (e) { return false; }
};
