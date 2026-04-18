import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/** 보호 라우트 접근 전 인증 상태를 검사한다. */
export const middleware = async (request: NextRequest) => {
  return updateSession(request);
};

export const config = {
  matcher: ["/", "/login"],
};
