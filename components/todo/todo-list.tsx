import { ListTodo } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

import type { Todo } from "./types"
import { TodoCard, type TodoCardProps } from "./todo-card"

export type TodoListProps = {
  todos: Todo[]
  emptyTitle?: string
  emptyDescription?: string
  onToggleComplete?: TodoCardProps["onToggleComplete"]
  onEdit?: TodoCardProps["onEdit"]
  onDelete?: TodoCardProps["onDelete"]
  className?: string
  listClassName?: string
}

/** 할 일 목록 또는 빈 상태를 렌더링한다. */
export const TodoList = ({
  todos,
  emptyTitle = "할 일이 없습니다",
  emptyDescription = "새 할 일을 추가하거나 AI로 생성해 보세요.",
  onToggleComplete,
  onEdit,
  onDelete,
  className,
  listClassName,
}: TodoListProps) => {
  if (todos.length === 0) {
    return (
      <Empty className={cn("border-border border", className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListTodo />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul
      className={cn("flex flex-col gap-3 p-0", listClassName, className)}
      aria-label="할 일 목록"
    >
      {todos.map((todo) => (
        <li key={todo.id} className="list-none">
          <TodoCard
            todo={todo}
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  )
}
