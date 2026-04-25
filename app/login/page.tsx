"use client"

import type { AuthError } from "@supabase/supabase-js"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ListTodo, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"

/** 로그인 오류를 사용자 안내 문구로 변환한다. */
const mapLoginError = (error: AuthError): string => {
  const raw = error.message.toLowerCase()

  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid_credentials") ||
    raw.includes("invalid email or password")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다."
  }
  if (raw.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요."
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return "네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
  }

  return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요."
}

/** 이메일/비밀번호 로그인 화면을 렌더링한다. */
const LoginPage = () => {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return
      router.replace("/")
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  /** 로그인 폼 제출을 처리한다. */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")

    if (!email) {
      setError("이메일을 입력해 주세요.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("올바른 이메일 형식이 아닙니다.")
      return
    }
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.")
      return
    }

    setPending(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(mapLoginError(signInError))
        return
      }

      router.push("/")
      router.refresh()
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message.toLowerCase() : ""
      if (message.includes("fetch")) {
        setError("네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.")
      } else {
        setError("예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-muted/50 flex min-h-dvh flex-col items-center justify-center gap-8 p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl ring-1 ring-primary/20"
            aria-hidden
          >
            <div className="relative">
              <ListTodo className="size-8" strokeWidth={1.75} />
              <Sparkles className="text-primary absolute -right-1 -top-1 size-4" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight">
              AI 할 일 매니저
            </h1>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed text-balance">
              AI가 도와주는 스마트한 할 일 관리로 할 일을 정리하고, 직관적인
              화면에서 빠르게 관리해 보세요.
            </p>
          </div>
        </div>

        <Card className="w-full shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>로그인</CardTitle>
            <CardDescription>
              이메일과 비밀번호로 로그인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="login-email">이메일</FieldLabel>
                  <FieldContent>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      disabled={pending}
                      required
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
                  <FieldContent>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={pending}
                      required
                    />
                    <FieldDescription>
                      계정에 설정한 비밀번호를 입력해 주세요.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={pending}>
                {pending ? (
                  <>
                    <Spinner className="size-4" />
                    로그인 중…
                  </>
                ) : (
                  "로그인"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-muted-foreground flex flex-col gap-2 border-t pt-4 text-center text-sm">
            <p>
              계정이 없으신가요?{" "}
              <Link
                href="/signup"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                회원가입
              </Link>
            </p>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              홈으로 돌아가기
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default LoginPage
