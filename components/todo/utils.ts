import { format, isPast, parseISO } from "date-fns"
import { ko } from "date-fns/locale"

import type { Todo, TodoPriority } from "./types"

/** 할 일이 지연 상태인지 계산한다. */
export const isTodoOverdue = (todo: Pick<Todo, "due_date" | "completed">): boolean => {
  if (todo.completed || !todo.due_date) return false
  const d = parseISO(todo.due_date)
  if (Number.isNaN(d.getTime())) return false
  return isPast(d)
}

/** ISO 마감일 문자열을 한국어 표시 포맷으로 변환한다. */
export const formatTodoDueDate = (iso: string | null): string | null => {
  if (!iso) return null
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return null
  return format(d, "PPP p", { locale: ko })
}

/** `<input type="datetime-local" />` 값으로 변환 */
export const toDatetimeLocalValue = (iso: string | null): string => {
  if (!iso) return ""
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local 문자열을 ISO 문자열로 변환한다. */
export const fromDatetimeLocalToIso = (local: string): string | null => {
  if (!local.trim()) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** 쉼표 구분 카테고리 입력을 배열로 정규화한다. */
export const parseCategoriesInput = (raw: string): string[] => {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
}
