"use client"

import { Calendar, Pencil, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import type { Todo, TodoPriority } from "./types"
import { formatTodoDueDate, isTodoOverdue, PRIORITY_LABEL } from "./utils"

/** 우선순위에 맞는 배지 스타일을 반환한다. */
const priorityBadgeVariant = (
  p: TodoPriority | null
): "default" | "secondary" | "destructive" | "outline" => {
  if (p === "high") return "destructive"
  if (p === "medium") return "default"
  if (p === "low") return "secondary"
  return "outline"
}

export type TodoCardProps = {
  todo: Todo
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

/** 할 일 단일 카드를 표시하고 액션을 연결한다. */
export const TodoCard = ({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
  className,
}: TodoCardProps) => {
  const overdue = isTodoOverdue(todo)
  const dueLabel = formatTodoDueDate(todo.due_date)

  return (
    <Card
      className={cn(
        todo.completed && "opacity-80 ring-muted-foreground/20",
        className
      )}
      data-completed={todo.completed || undefined}
      data-overdue={overdue || undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={(v) =>
              onToggleComplete?.(todo.id, v === true)
            }
            disabled={!onToggleComplete}
            aria-label={todo.completed ? "완료 취소" : "완료로 표시"}
            className="mt-0.5"
          />
          <CardTitle
            className={cn(
              "min-w-0 flex-1 pr-2",
              todo.completed && "text-muted-foreground line-through"
            )}
          >
            {todo.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {todo.description ? (
          <p
            className={cn(
              "text-muted-foreground text-sm leading-relaxed",
              todo.completed && "line-through"
            )}
          >
            {todo.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {todo.priority ? (
            <Badge variant={priorityBadgeVariant(todo.priority)}>
              {PRIORITY_LABEL[todo.priority]}
            </Badge>
          ) : null}
          {overdue ? (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              지연
            </Badge>
          ) : null}
          {dueLabel ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Calendar className="size-3.5 shrink-0" aria-hidden />
              {dueLabel}
            </span>
          ) : null}
        </div>
        {todo.category.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {todo.category.map((c) => (
              <Badge key={c} variant="outline" className="font-normal">
                {c}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
      {(onEdit ?? onDelete) ? (
        <CardFooter className="justify-end gap-2 pt-2">
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(todo.id)}
            >
              <Pencil className="size-3.5" />
              편집
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(todo.id)}
            >
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
