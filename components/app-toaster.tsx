"use client"

import { Toaster } from "sonner"

/** ThemeProvider 없이도 동작하는 전역 토스트 (로그아웃 오류 등). */
export const AppToaster = () => {
  return <Toaster position="top-center" richColors closeButton />
}
