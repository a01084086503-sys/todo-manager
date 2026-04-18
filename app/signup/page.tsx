"use client"

import type { AuthError } from "@supabase/supabase-js"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
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

/** 회원가입 오류를 사용자 안내 문구로 변환한다. */
const mapSignupError = (error: AuthError): string => {
  const raw = error.message.toLowerCase()

  if (
    raw.includes("already registered") ||
    raw.includes("already been registered") ||
    raw.includes("user already exists")
  ) {
    return "이미 가입된 이메일입니다. 로그인을 이용해 주세요."
  }
  if (raw.includes("password") && raw.includes("least")) {
    return "비밀번호가 서버에서 요구하는 최소 길이를 만족하지 않습니다. 더 긴 비밀번호를 사용해 주세요."
  }
  if (raw.includes("invalid") && raw.includes("email")) {
    return "이메일 형식이 올바르지 않습니다."
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return "네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요."
  }

  return "가입에 실패했습니다. 입력 정보를 확인하거나 잠시 후 다시 시도해 주세요."
}

/** 이메일 회원가입 화면을 렌더링한다. */
const SignupPage = () => {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<string | null>(null)

  /** 회원가입 폼 제출을 처리한다. */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccessInfo(null)

    const form = e.currentTarget
    const data = new FormData(form)
    const name = String(data.get("name") ?? "").trim()
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")

    if (!name) {
      setError("이름을 입력해 주세요.")
      return
    }
    if (name.length > 80) {
      setError("이름은 80자 이하로 입력해 주세요.")
      return
    }
    if (!email) {
      setError("이메일을 입력해 주세요.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("올바른 이메일 형식이 아닙니다.")
      return
    }
    if (!password) {
      setError("비밀번호를 입력해 주세요.")
      return
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.")
      return
    }

    setPending(true)
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: origin ? `${origin}/login` : undefined,
          data: {
            full_name: name,
          },
        },
      })

      if (signUpError) {
        setError(mapSignupError(signUpError))
        return
      }

      if (signUpData.session) {
        router.push("/")
        router.refresh()
        return
      }

      setSuccessInfo(
        "가입이 완료되었습니다. 이메일로 전송된 인증 링크를 확인한 뒤 로그인해 주세요.",
      )
      form.reset()
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

  const formDisabled = pending || !!successInfo

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
              AI로 할 일을 자동 구조화하고, 요약·분석으로 생산성을 높여 보세요.
            </p>
          </div>
        </div>

        <Card className="w-full shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>회원가입</CardTitle>
            <CardDescription>
              이름과 이메일, 비밀번호로 계정을 만듭니다. 이메일 인증이 켜져 있으면
              메일의 링크 확인 후 로그인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="signup-name">이름</FieldLabel>
                  <FieldContent>
                    <Input
                      id="signup-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="홍길동"
                      disabled={formDisabled}
                      maxLength={80}
                      required
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
                  <FieldContent>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      disabled={formDisabled}
                      required
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
                  <FieldContent>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      disabled={formDisabled}
                      minLength={6}
                      required
                    />
                    <FieldDescription>6자 이상 입력해 주세요.</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              {successInfo ? (
                <p className="text-foreground text-sm" role="status">
                  {successInfo}
                </p>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={formDisabled}>
                {pending ? (
                  <>
                    <Spinner className="size-4" />
                    가입 처리 중…
                  </>
                ) : (
                  "회원가입"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-muted-foreground flex flex-col gap-2 border-t pt-4 text-center text-sm">
            <p>
              이미 계정이 있으신가요?{" "}
              <Link
                href="/login"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                로그인
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

export default SignupPage
