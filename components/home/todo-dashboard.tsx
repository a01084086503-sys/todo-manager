"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { TodoForm, TodoList } from "@/components/todo"
import type { Todo, TodoFormValues, TodoPriority } from "@/components/todo/types"
import { isTodoOverdue } from "@/components/todo/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { AppHeader } from "./app-header"
import { AppToolbar, type SortOption, type StatusFilter } from "./app-toolbar"

type SessionUser = {
  id: string
  email: string
}

type TodoDashboardProps = {
  initialSessionUser: SessionUser
  initialTodos: Todo[]
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
  const title = todo.title.toLowerCase()
  return title.includes(s)
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
  const [sortBy, setSortBy] = useState<SortOption>("created_at")

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

    const sorted = [...list]
    if (sortBy === "priority") {
      sorted.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    } else if (sortBy === "due_date") {
      sorted.sort((a, b) => {
        const ta = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
        const tb = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
        return ta - tb
      })
    } else if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"))
    } else {
      sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return sorted
  }, [todos, search, statusFilter, priorityFilter, sortBy])

  const filterActive =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    priorityFilter !== "all"

  const emptyTitle = filterActive
    ? "표시할 할 일이 없습니다"
    : undefined
  const emptyDescription = filterActive
    ? "검색어나 필터를 바꿔 보세요."
    : undefined

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
        sortBy={sortBy}
        onSortByChange={setSortBy}
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
                  제목, 설명, 마감일, 우선순위, 카테고리를 입력할 수 있습니다.
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
