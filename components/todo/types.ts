/** PRD: high / medium / low */
export type TodoPriority = "high" | "medium" | "low"

/** PRD todos 테이블 필드 */
export type Todo = {
  id: string
  user_id: string
  title: string
  description: string | null
  created_at: string
  due_date: string | null
  priority: TodoPriority | null
  category: string[]
  completed: boolean
}

/** TodoForm 제출 페이로드 (DB 저장 전 변환용) */
export type TodoFormValues = {
  title: string
  description: string
  due_date: string | null
  priority: TodoPriority
  category: string[]
  completed: boolean
}
