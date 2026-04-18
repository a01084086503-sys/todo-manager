"use client"

import Link from "next/link"
import { ListTodo, LogOut, Sparkles } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type AppHeaderProps = {
  authReady: boolean
  isAuthenticated: boolean
  userEmail: string
  userDisplayName: string
  onLogout: () => void | Promise<void>
  logoutPending?: boolean
  className?: string
}

/** 표시 이름/이메일에서 아바타 이니셜을 만든다. */
const initials = (name: string, email: string) => {
  const t = name.trim()
  if (t.length >= 2) return t.slice(0, 2)
  const local = email.split("@")[0] ?? email
  return local.slice(0, 2).toUpperCase() || "?"
}

/** 인증 상태와 사용자 정보를 상단 헤더에 표시한다. */
export const AppHeader = ({
  authReady,
  isAuthenticated,
  userEmail,
  userDisplayName,
  onLogout,
  logoutPending = false,
  className,
}: AppHeaderProps) => {
  const abbr = initials(userDisplayName, userEmail)

  return (
    <header
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary/15"
            aria-hidden
          >
            <div className="relative">
              <ListTodo className="size-5" strokeWidth={1.75} />
              <Sparkles className="text-primary absolute -right-0.5 -top-0.5 size-3" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold tracking-tight">
              AI 할 일 매니저
            </p>
            <p className="text-muted-foreground hidden text-xs sm:block">
              스마트 To-Do
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!authReady ? (
            <div className="h-9 w-[120px] shrink-0" aria-hidden />
          ) : !isAuthenticated ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/login">로그인</Link>
            </Button>
          ) : (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <Avatar size="sm" className="size-8">
                  <AvatarFallback className="text-xs font-medium">{abbr}</AvatarFallback>
                </Avatar>
                <div className="max-w-[160px] text-right leading-tight md:max-w-[220px]">
                  <p className="truncate text-sm font-medium">{userDisplayName}</p>
                  <p className="text-muted-foreground truncate text-xs">{userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:hidden">
                <Avatar size="sm" className="size-8">
                  <AvatarFallback className="text-xs font-medium">{abbr}</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground max-w-[100px] truncate text-xs font-medium">
                  {userDisplayName}
                </span>
              </div>
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void onLogout()}
                disabled={logoutPending}
              >
                {logoutPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {logoutPending ? "로그아웃 중…" : "로그아웃"}
                </span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
