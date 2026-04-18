import { redirect } from "next/navigation"

import { TodoDashboard } from "@/components/home/todo-dashboard"
import type { Todo } from "@/components/todo/types"
import { createClient } from "@/lib/supabase/server"

/** 서버에서 인증 사용자 할 일 목록을 초기 로드한다. */
const Home = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data, error } = await supabase
    .from("todos")
    .select("id, user_id, title, description, created_at, due_date, priority, category, completed")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <TodoDashboard
        initialSessionUser={{ id: user.id, email: user.email ?? "" }}
        initialTodos={[]}
      />
    )
  }

  const initialTodos: Todo[] = (data ?? []).map((row) => ({
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

  return (
    <TodoDashboard
      initialSessionUser={{ id: user.id, email: user.email ?? "" }}
      initialTodos={initialTodos}
    />
  )
}

export default Home
