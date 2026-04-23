"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Lightbulb, Target } from "lucide-react"
import { toast } from "sonner"

import { TodoForm, TodoList } from "@/components/todo"
import type { Todo, TodoFormValues, TodoPriority } from "@/components/todo/types"
import { PRIORITY_LABEL, isTodoOverdue } from "@/components/todo/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { AppHeader } from "./app-header"
import {
  AppToolbar,
  type CategoryFilter,
  type SortOption,
  type SortOrder,
  type StatusFilter,
} from "./app-toolbar"

type SessionUser = {
  id: string
  email: string
}

type TodoDashboardProps = {
  initialSessionUser: SessionUser
  initialTodos: Todo[]
}

type SummaryPeriod = "today" | "week"

type AiSummaryResponse = {
  summary: string
  urgentTasks: string[]
  insights: string[]
  recommendations: string[]
}

type PeriodTodoStats = {
  todos: Todo[]
  total: number
  completed: number
  completionRate: number
}

type InsightTone = "idea" | "caution" | "goal"

const insightToneOrder: InsightTone[] = ["idea", "caution", "goal"]

/** 요약 인사이트 유형에 맞는 아이콘/라벨을 반환한다. */
const insightMeta = (tone: InsightTone) => {
  if (tone === "idea") return { icon: Lightbulb, emoji: "💡", label: "아이디어" }
  if (tone === "caution") return { icon: AlertTriangle, emoji: "⚠️", label: "주의" }
  return { icon: Target, emoji: "🎯", label: "목표" }
}

/** 기준 날짜에서 시작/끝 시각을 계산한다. */
const getPeriodBounds = (period: SummaryPeriod, base: Date) => {
  const start = new Date(base)
  const end = new Date(base)
  if (period === "today") {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  start.setDate(base.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** 할 일이 기간 안에 포함되는지 확인한다. */
const isTodoWithinPeriod = (todo: Todo, start: Date, end: Date): boolean => {
  const baseDate = todo.due_date ?? todo.created_at
  const parsed = new Date(baseDate)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime()
}

/** 우선순위를 정렬 가능한 숫자 값으로 변환한다. */
const priorityRank = (p: TodoPriority | null): number => {
  if (p === "high") return 0
  if (p === "medium") return 1
  if (p === "low") return 2
  return 3
}

/** 제목 기준 검색어 일치 여부를 확인한다. */
const matchesSearch = (todo: Todo, q: string): boolean => {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return todo.title.toLowerCase().includes(s)
}

/** 사용자 이메일에서 화면 표시용 이름을 만든다. */
const displayNameFromSession = (email: string): string => {
  const local = email.split("@")[0] ?? ""
  return local || "사용자"
}

/** 인증 사용자의 할 일을 조회·편집·정렬해 대시보드를 렌더링한다. */
export const TodoDashboard = ({ initialSessionUser, initialTodos }: TodoDashboardProps) => {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [session, setSession] = useState<SessionUser | null>(initialSessionUser)
  const [logoutPending, setLogoutPending] = useState(false)
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [loadingTodos, setLoadingTodos] = useState(false)

  const handleDataError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const message = error instanceof Error ? error.message.toLowerCase() : ""
      const isAuthExpired =
        message.includes("jwt") ||
        message.includes("auth") ||
        message.includes("token") ||
        message.includes("session")

      console.error("[todo-error]", error)
      if (isAuthExpired) {
        toast.error("인증이 만료되었습니다. 다시 로그인해 주세요.")
        setSession(null)
        router.replace("/login")
        router.refresh()
        return
      }
      toast.error(fallbackMessage)
    },
    [router]
  )

  const loadTodos = useCallback(async (userId: string) => {
    setLoadingTodos(true)
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("id, user_id, title, description, created_at, due_date, priority, category, completed")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      const normalized: Todo[] = (data ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        created_at: row.created_at,
        due_date: row.due_date,
        priority: row.priority,
        category: row.category ?? [],
        completed: row.completed,
      }))
      setTodos(normalized)
    } catch (error) {
      handleDataError(error, "할 일 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      setLoadingTodos(false)
    }
  }, [supabase, handleDataError])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUser = next?.user
      if (!nextUser) {
        setSession(null)
        setTodos([])
        return
      }

      const email = nextUser.email ?? ""
      setSession({ id: nextUser.id, email })
      void loadTodos(nextUser.id)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, loadTodos])
  useEffect(() => {
    if (session) return
    router.replace("/login")
    router.refresh()
  }, [session, router])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | TodoPriority>("all")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("created_at")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("today")
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryLoadingPeriod, setSummaryLoadingPeriod] = useState<SummaryPeriod | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryByPeriod, setSummaryByPeriod] = useState<
    Partial<Record<SummaryPeriod, AiSummaryResponse>>
  >({})

  const editingTodo = editingId
    ? todos.find((t) => t.id === editingId) ?? null
    : null

  const filteredTodos = useMemo(() => {
    let list = todos.filter((t) => matchesSearch(t, search))

    if (statusFilter === "active") {
      list = list.filter((t) => !t.completed)
    } else if (statusFilter === "completed") {
      list = list.filter((t) => t.completed)
    } else if (statusFilter === "overdue") {
      list = list.filter((t) => isTodoOverdue(t))
    }

    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter)
    }
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category.includes(categoryFilter))
    }

    const sorted = [...list]
    const direction = sortOrder === "asc" ? 1 : -1
    if (sortBy === "priority") {
      sorted.sort((a, b) => (priorityRank(a.priority) - priorityRank(b.priority)) * direction)
    } else if (sortBy === "due_date") {
      sorted.sort((a, b) => {
        const ta = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
        const tb = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
        return (ta - tb) * direction
      })
    } else if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko") * direction)
    } else {
      sorted.sort(
        (a, b) =>
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction
      )
    }

    return sorted
  }, [todos, search, statusFilter, priorityFilter, categoryFilter, sortBy, sortOrder])

  const filterActive =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    categoryFilter !== "all"

  const emptyTitle = filterActive
    ? "표시할 할 일이 없습니다"
    : undefined
  const emptyDescription = filterActive
    ? "검색어나 필터를 바꿔 보세요."
    : undefined

  /** 지정한 기간의 AI 요약/분석을 생성한다. */
  const handleAiSummaryGenerate = useCallback(
    async (period: SummaryPeriod) => {
      setSummaryLoading(true)
      setSummaryLoadingPeriod(period)
      setSummaryError(null)
      try {
        const response = await fetch("/api/ai/todo-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period, todos }),
        })
        const data = (await response.json()) as AiSummaryResponse | { message?: string }
        if (!response.ok) {
          const message = "message" in data ? data.message : "AI 요약 생성에 실패했습니다."
          throw new Error(message ?? "AI 요약 생성에 실패했습니다.")
        }
        const summary = data as AiSummaryResponse
        setSummaryByPeriod((prev) => ({ ...prev, [period]: summary }))
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "AI 요약 생성 중 오류가 발생했습니다."
        setSummaryError(message)
        toast.error(message)
      } finally {
        setSummaryLoading(false)
        setSummaryLoadingPeriod(null)
      }
    },
    [todos]
  )

  /** 현재 탭 기준으로 AI 요약 요청을 재시도한다. */
  const handleRetrySummary = useCallback(() => {
    void handleAiSummaryGenerate(summaryPeriod)
  }, [handleAiSummaryGenerate, summaryPeriod])

  /** 툴바 버튼에서 오늘 요약 생성 요청을 바로 실행한다. */
  const handleAiSummaryClick = () => {
    setSummaryPeriod("today")
    void handleAiSummaryGenerate("today")
  }

  /** 현재 세션을 종료하고 로그인 화면으로 이동한다. */
  const handleLogout = async () => {
    setLogoutPending(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }
      router.push("/login")
      router.refresh()
    } finally {
      setLogoutPending(false)
    }
  }

  const activeUserId = session?.id ?? null
  const activeSummary = summaryByPeriod[summaryPeriod]

  const periodStats = useMemo(() => {
    const now = new Date()
    const calc = (period: SummaryPeriod): PeriodTodoStats => {
      const { start, end } = getPeriodBounds(period, now)
      const inPeriod = todos.filter((todo) => isTodoWithinPeriod(todo, start, end))
      const completed = inPeriod.filter((todo) => todo.completed).length
      const completionRate =
        inPeriod.length === 0 ? 0 : Number(((completed / inPeriod.length) * 100).toFixed(1))
      return {
        todos: inPeriod,
        total: inPeriod.length,
        completed,
        completionRate,
      }
    }
    return {
      today: calc("today"),
      week: calc("week"),
    }
  }, [todos])

  const todayRemainingTodos = useMemo(() => {
    return periodStats.today.todos
      .filter((todo) => !todo.completed)
      .sort((a, b) => {
        const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority)
        if (priorityDiff !== 0) return priorityDiff
        const at = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
        const bt = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
        return at - bt
      })
  }, [periodStats.today.todos])

  const todayFocusTodo = todayRemainingTodos[0] ?? null

  const weeklyDayBuckets = useMemo(() => {
    const now = new Date()
    const { start } = getPeriodBounds("week", now)
    const days = ["월", "화", "수", "목", "금", "토", "일"]
    const mapped = days.map((label, idx) => {
      const dayStart = new Date(start)
      dayStart.setDate(start.getDate() + idx)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const dayTodos = periodStats.week.todos.filter((todo) => isTodoWithinPeriod(todo, dayStart, dayEnd))
      const completed = dayTodos.filter((todo) => todo.completed).length
      const rate = dayTodos.length === 0 ? 0 : Number(((completed / dayTodos.length) * 100).toFixed(1))
      return {
        label,
        total: dayTodos.length,
        completed,
        completionRate: rate,
      }
    })
    return mapped
  }, [periodStats.week.todos])

  const weeklyTrend = useMemo(() => {
    const now = new Date()
    const thisWeek = getPeriodBounds("week", now)
    const prevStart = new Date(thisWeek.start)
    const prevEnd = new Date(thisWeek.end)
    prevStart.setDate(prevStart.getDate() - 7)
    prevEnd.setDate(prevEnd.getDate() - 7)
    const prevTodos = todos.filter((todo) => isTodoWithinPeriod(todo, prevStart, prevEnd))
    const prevCompleted = prevTodos.filter((todo) => todo.completed).length
    const prevRate = prevTodos.length === 0 ? 0 : Number(((prevCompleted / prevTodos.length) * 100).toFixed(1))
    return Number((periodStats.week.completionRate - prevRate).toFixed(1))
  }, [periodStats.week.completionRate, todos])

  /** 새 할 일을 저장하고 최신 목록을 다시 불러온다. */
  const handleCreateSubmit = async (values: TodoFormValues) => {
    if (!activeUserId) {
      toast.error("로그인이 필요합니다. 다시 로그인해 주세요.")
      return
    }

    try {
      const { error } = await supabase.from("todos").insert({
        user_id: activeUserId,
        title: values.title,
        description: values.description.trim() ? values.description.trim() : null,
        due_date: values.due_date,
        priority: values.priority,
        category: values.category,
        completed: values.completed,
      })

      if (error) {
        throw error
      }
      await loadTodos(activeUserId)
    } catch (error) {
      handleDataError(error, "할 일을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  /** 선택한 할 일을 수정하고 목록을 갱신한다. */
  const handleEditSubmit = async (values: TodoFormValues) => {
    if (!editingId) return
    if (!activeUserId) {
      toast.error("로그인이 필요합니다. 다시 로그인해 주세요.")
      return
    }
    try {
      const { error } = await supabase
        .from("todos")
        .update({
          title: values.title,
          description: values.description.trim() ? values.description.trim() : null,
          due_date: values.due_date,
          priority: values.priority,
          category: values.category,
          completed: values.completed,
        })
        .eq("id", editingId)
        .eq("user_id", activeUserId)

      if (error) {
        throw error
      }
      setEditingId(null)
      await loadTodos(activeUserId)
    } catch (error) {
      handleDataError(error, "할 일을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  /** 완료 상태를 토글하고 목록을 다시 동기화한다. */
  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (!activeUserId) {
      toast.error("로그인이 필요합니다. 다시 로그인해 주세요.")
      return
    }
    try {
      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id)
        .eq("user_id", activeUserId)

      if (error) {
        throw error
      }
      await loadTodos(activeUserId)
    } catch (error) {
      handleDataError(error, "완료 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  /** 편집 대상 할 일을 선택한다. */
  const handleEdit = (id: string) => {
    setEditingId(id)
  }

  /** 할 일을 삭제하고 최신 목록을 다시 조회한다. */
  const handleDelete = async (id: string) => {
    if (!activeUserId) {
      toast.error("로그인이 필요합니다. 다시 로그인해 주세요.")
      return
    }
    if (!window.confirm("이 할 일을 삭제하시겠습니까?")) {
      return
    }
    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id)
        .eq("user_id", activeUserId)

      if (error) {
        throw error
      }
      setEditingId((cur) => (cur === id ? null : cur))
      await loadTodos(activeUserId)
    } catch (error) {
      handleDataError(error, "할 일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  if (!session) {
    return null
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <AppHeader
        authReady
        isAuthenticated={!!session}
        userEmail={session?.email ?? ""}
        userDisplayName={session ? displayNameFromSession(session.email) : ""}
        onLogout={handleLogout}
        logoutPending={logoutPending}
      />
      <AppToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onAiSummaryClick={handleAiSummaryClick}
      />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 md:gap-8 md:p-6 lg:grid-cols-12">
          <section className="flex flex-col gap-3 lg:col-span-5 xl:col-span-4">
            <div>
              <h2 className="text-foreground text-lg font-semibold tracking-tight">
                {editingId ? "할 일 수정" : "할 일 추가"}
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {editingId
                  ? "항목을 수정한 뒤 저장하세요."
                  : "새 작업을 등록합니다."}
              </p>
            </div>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {editingId ? "편집" : "새 할 일"}
                </CardTitle>
                <CardDescription className="text-xs">
                  제목, 설명, 마감일, 우선순위, 카테고리를 직접 입력하거나 AI 모드로 자동 생성할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {editingTodo ? (
                  <TodoForm
                    key={editingTodo.id}
                    mode="edit"
                    defaultValues={editingTodo}
                    onSubmit={handleEditSubmit}
                    onCancel={() => setEditingId(null)}
                    submitLabel="저장"
                  />
                ) : (
                  <TodoForm
                    key="create"
                    mode="create"
                    onSubmit={handleCreateSubmit}
                  />
                )}
              </CardContent>
            </Card>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-7 xl:col-span-8">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI 요약 및 분석</CardTitle>
                <CardDescription className="text-xs">
                  오늘 또는 이번 주 할 일을 분석해 진행 상황과 실행 가능한 추천을 제공합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs
                  value={summaryPeriod}
                  onValueChange={(value) => setSummaryPeriod(value as SummaryPeriod)}
                >
                  <TabsList>
                    <TabsTrigger value="today">오늘의 요약</TabsTrigger>
                    <TabsTrigger value="week">이번 주 요약</TabsTrigger>
                  </TabsList>

                  <TabsContent value="today" className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-muted-foreground text-sm">
                        당일 할 일을 기반으로 요약과 인사이트를 생성합니다.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={summaryLoading}
                        onClick={() => void handleAiSummaryGenerate("today")}
                      >
                        {summaryLoading && summaryLoadingPeriod === "today" ? (
                          <>
                            <Spinner className="size-4" />
                            분석 중...
                          </>
                        ) : (
                          "AI 요약 보기"
                        )}
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Card className="md:col-span-1">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">완료율</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-3xl font-semibold">{periodStats.today.completionRate}%</p>
                          <Progress value={periodStats.today.completionRate} className="h-2" />
                          <p className="text-muted-foreground text-xs">
                            총 {periodStats.today.total}개 중 {periodStats.today.completed}개 완료
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">오늘 집중해야 할 작업</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {todayFocusTodo ? (
                            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                              <p className="font-medium">{todayFocusTodo.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                  우선순위: {PRIORITY_LABEL[todayFocusTodo.priority ?? "medium"]}
                                </Badge>
                                <Badge variant="outline">
                                  {todayFocusTodo.due_date
                                    ? `마감 ${new Date(todayFocusTodo.due_date).toLocaleString("ko-KR")}`
                                    : "마감일 없음"}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">남은 할 일이 없습니다.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">남은 할 일</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {todayRemainingTodos.length === 0 ? (
                          <p className="text-muted-foreground text-sm">오늘 남은 작업이 없습니다.</p>
                        ) : (
                          <div className="space-y-2">
                            {todayRemainingTodos.slice(0, 5).map((todo) => (
                              <div
                                key={todo.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                              >
                                <p className="text-sm font-medium">{todo.title}</p>
                                <Badge variant={todo.priority === "high" ? "destructive" : "secondary"}>
                                  {PRIORITY_LABEL[todo.priority ?? "medium"]}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="week" className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-muted-foreground text-sm">
                        이번 주 전체 할 일 흐름을 분석해 집중 구간과 추천을 제시합니다.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={summaryLoading}
                        onClick={() => void handleAiSummaryGenerate("week")}
                      >
                        {summaryLoading && summaryLoadingPeriod === "week" ? (
                          <>
                            <Spinner className="size-4" />
                            분석 중...
                          </>
                        ) : (
                          "AI 요약 보기"
                        )}
                      </Button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">주간 완료율</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-3xl font-semibold">{periodStats.week.completionRate}%</p>
                          <Progress value={periodStats.week.completionRate} className="h-2" />
                          <p className="text-muted-foreground text-xs">
                            전주 대비 {weeklyTrend >= 0 ? "+" : ""}
                            {weeklyTrend}%p
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">요일별 생산성 패턴</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-7 gap-2">
                            {weeklyDayBuckets.map((day) => (
                              <div key={day.label} className="flex flex-col items-center gap-1">
                                <div className="flex h-24 w-full items-end rounded-md bg-muted/40 p-1">
                                  <div
                                    className="w-full rounded bg-primary/80"
                                    style={{ height: `${Math.max(day.completionRate, 4)}%` }}
                                  />
                                </div>
                                <p className="text-xs font-medium">{day.label}</p>
                                <p className="text-muted-foreground text-[11px]">{day.completionRate}%</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">다음 주 계획 제안</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {activeSummary?.recommendations?.length ? (
                          <ul className="space-y-2">
                            {activeSummary.recommendations.slice(0, 3).map((item) => (
                              <li key={item} className="rounded-md border p-2 text-sm">
                                {item}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            AI 요약 보기를 누르면 다음 주 계획 제안을 확인할 수 있습니다.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {summaryError ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-destructive text-sm">{summaryError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRetrySummary}
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? (
                        <>
                          <Spinner className="size-4" />
                          재시도 중...
                        </>
                      ) : (
                        "재시도"
                      )}
                    </Button>
                  </div>
                ) : null}

                {summaryLoading ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
                    <Spinner className="size-4" />
                    <span>AI가 분석 중입니다. 잠시만 기다려 주세요.</span>
                  </div>
                ) : null}

                {activeSummary ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="font-medium">요약</p>
                      <p className="text-muted-foreground mt-1">{activeSummary.summary}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <p className="font-medium">긴급 작업</p>
                        {activeSummary.urgentTasks.length === 0 ? (
                          <p className="text-muted-foreground mt-1">긴급 작업이 없습니다.</p>
                        ) : (
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {activeSummary.urgentTasks.map((task) => (
                              <li key={task}>{task}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-md border p-3 md:col-span-2">
                        <p className="font-medium">인사이트</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {activeSummary.insights.map((insight, idx) => {
                            const tone = insightToneOrder[idx % insightToneOrder.length]
                            const meta = insightMeta(tone)
                            const Icon = meta.icon
                            return (
                              <div key={insight} className="rounded-md border bg-muted/20 p-2">
                                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                                  <Icon className="size-3.5" />
                                  <span>{meta.emoji}</span>
                                  <span>{meta.label}</span>
                                </div>
                                <p className="text-sm">{insight}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="rounded-md border p-3 md:col-span-3">
                        <p className="font-medium">추천 사항</p>
                        <ul className="mt-2 space-y-2">
                          {activeSummary.recommendations.map((recommendation) => (
                            <li key={recommendation} className="rounded-md border bg-muted/20 p-2">
                              {recommendation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div>
              <h2 className="text-foreground text-lg font-semibold tracking-tight">
                할 일 목록
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {filteredTodos.length}건 표시
                {filterActive ? " (필터 적용 중)" : ""}
                {loadingTodos ? " · 동기화 중" : ""}
              </p>
            </div>
            <div className="border-border bg-muted/20 min-h-[min(60vh,32rem)] flex-1 overflow-y-auto rounded-xl border p-3 sm:p-4">
              <TodoList
                todos={filteredTodos}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyTitle={emptyTitle}
                emptyDescription={emptyDescription}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
