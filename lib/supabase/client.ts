import { createBrowserClient } from "@supabase/ssr";

/** 브라우저 환경에서 사용하는 Supabase 클라이언트를 생성한다. */
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
