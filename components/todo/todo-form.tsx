"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { Todo, TodoFormValues, TodoPriority } from "./types"
import {
  fromDatetimeLocalToIso,
  parseCategoriesInput,
  PRIORITY_LABEL,
  toDatetimeLocalValue,
} from "./utils"

export type TodoFormProps = {
  mode: "create" | "edit"
  defaultValues?: Partial<
    Pick<Todo, "title" | "description" | "due_date" | "priority" | "category" | "completed">
  >
  onSubmit: (values: TodoFormValues) => void | Promise<void>
  onCancel?: () => void
  submitLabel?: string
  className?: string
}

const defaultPriority: TodoPriority = "medium"

type AiParseResponse = {
  title: string
  description: string
  due_date: string | null
  due_time: string | null
  priority: TodoPriority
  category: string[]
}

/** AI 파싱 결과의 날짜/시간을 datetime-local 값으로 합친다. */
const toDueLocalValue = (dueDate: string | null, dueTime: string | null): string => {
  if (!dueDate) return ""
  const time = dueTime ?? "09:00"
  return `${dueDate}T${time}`
}

/** 수동 입력과 AI 보조 입력으로 할 일 폼을 처리한다. */
export const TodoForm = ({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  className,
}: TodoFormProps) => {
  const initial = useMemo(
    () => ({
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      dueLocal: toDatetimeLocalValue(defaultValues?.due_date ?? null),
      priority: (defaultValues?.priority ?? defaultPriority) as TodoPriority,
      category: (defaultValues?.category ?? []).join(", "),
      completed: defaultValues?.completed ?? false,
    }),
    [defaultValues]
  )

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [dueLocal, setDueLocal] = useState(initial.dueLocal)
  const [priority, setPriority] = useState<TodoPriority>(initial.priority)
  const [category, setCategory] = useState(initial.category)
  const [completed, setCompleted] = useState(initial.completed)
  const [submitting, setSubmitting] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [aiPending, setAiPending] = useState(false)

  const handleAiGenerate = useCallback(async () => {
    const input = aiInput.trim()
    if (!input) {
      toast.error("AI 변환할 문장을 입력해 주세요.")
      return
    }

    setAiPending(true)
    try {
      const response = await fetch("/api/ai/todo-parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      })

      const data = (await response.json()) as AiParseResponse | { message?: string }

      if (!response.ok) {
        const message = "message" in data ? data.message : "AI 변환에 실패했습니다."
        throw new Error(message ?? "AI 변환에 실패했습니다.")
      }

      const parsed = data as AiParseResponse
      setTitle(parsed.title)
      setDescription(parsed.description)
      setDueLocal(toDueLocalValue(parsed.due_date, parsed.due_time))
      setPriority(parsed.priority)
      setCategory(parsed.category.join(", "))
      toast.success("AI가 입력값을 채웠습니다. 확인 후 추가해 주세요.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI 변환 중 오류가 발생했습니다."
      toast.error(message)
    } finally {
      setAiPending(false)
    }
  }, [aiInput])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const trimmed = title.trim()
      if (!trimmed) return

      const payload: TodoFormValues = {
        title: trimmed,
        description: description.trim(),
        due_date: fromDatetimeLocalToIso(dueLocal),
        priority,
        category: parseCategoriesInput(category),
        completed: mode === "edit" ? completed : false,
      }

      setSubmitting(true)
      try {
        await onSubmit(payload)
      } finally {
        setSubmitting(false)
      }
    },
    [title, description, dueLocal, priority, category, completed, mode, onSubmit]
  )

  const defaultSubmitLabel = mode === "create" ? "추가" : "저장"

  return (
    <form onSubmit={handleSubmit} className={className}>
      <FieldSet className="gap-4">
        <FieldGroup className="gap-4">
          {mode === "create" ? (
            <>
              <Field orientation="horizontal">
                <Checkbox
                  id="todo-ai-mode"
                  checked={aiMode}
                  onCheckedChange={(v) => setAiMode(v === true)}
                  disabled={aiPending || submitting}
                />
                <FieldLabel htmlFor="todo-ai-mode" className="font-normal">
                  AI 모드
                </FieldLabel>
              </Field>

              {aiMode ? (
                <Field>
                  <FieldLabel htmlFor="todo-ai-input">자연어 할 일 입력</FieldLabel>
                  <FieldContent>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="todo-ai-input"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
                        autoComplete="off"
                        maxLength={1000}
                        disabled={aiPending || submitting}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleAiGenerate()}
                        disabled={aiPending || submitting || !aiInput.trim()}
                        className="sm:shrink-0"
                      >
                        {aiPending ? "분석 중..." : "AI로 할 일 생성"}
                      </Button>
                    </div>
                    <FieldDescription>
                      자연어를 입력하면 제목, 설명, 마감일, 우선순위, 카테고리를 자동으로 채웁니다.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}
            </>
          ) : null}

          <Field>
            <FieldLabel htmlFor="todo-title">제목</FieldLabel>
            <FieldContent>
              <Input
                id="todo-title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="할 일 제목"
                required
                maxLength={500}
                autoComplete="off"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="todo-description">설명</FieldLabel>
            <FieldContent>
              <Textarea
                id="todo-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="상세 내용 (선택)"
                rows={4}
                maxLength={5000}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="todo-due">마감일</FieldLabel>
            <FieldContent>
              <Input
                id="todo-due"
                name="due_date"
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
              />
              <FieldDescription>비워 두면 마감 없음</FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="todo-priority">우선순위</FieldLabel>
            <FieldContent>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TodoPriority)}
              >
                <SelectTrigger id="todo-priority" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{PRIORITY_LABEL.high}</SelectItem>
                  <SelectItem value="medium">{PRIORITY_LABEL.medium}</SelectItem>
                  <SelectItem value="low">{PRIORITY_LABEL.low}</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="todo-category">카테고리</FieldLabel>
            <FieldContent>
              <Input
                id="todo-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="업무, 개인, 학습 (쉼표로 구분)"
              />
              <FieldDescription>여러 개면 쉼표로 구분해 입력하세요.</FieldDescription>
            </FieldContent>
          </Field>

          {mode === "edit" ? (
            <Field orientation="horizontal">
              <Checkbox
                id="todo-completed"
                checked={completed}
                onCheckedChange={(v) => setCompleted(v === true)}
              />
              <FieldLabel htmlFor="todo-completed" className="font-normal">
                완료됨
              </FieldLabel>
            </Field>
          ) : null}
        </FieldGroup>

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              취소
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitLabel ?? defaultSubmitLabel}
          </Button>
        </div>
      </FieldSet>
    </form>
  )
}
