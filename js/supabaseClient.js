// Supabase 클라이언트 초기화 (DB.md 참고)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ljjdlfygyzbeqfdntwpt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Puh78xYJOVuqhnI32I5qZw_n89dBeBH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
