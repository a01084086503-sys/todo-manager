"use client"

import { Search, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { PRIORITY_LABEL } from "@/components/todo/utils"
import type { TodoPriority } from "@/components/todo/types"

export type StatusFilter = "all" | "active" | "completed" | "overdue"
export type SortOption = "priority" | "due_date" | "created_at" | "title"
export type SortOrder = "asc" | "desc"
export type CategoryFilter = "all" | "업무" | "개인" | "학습"

export type AppToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  priorityFilter: "all" | TodoPriority
  onPriorityFilterChange: (value: "all" | TodoPriority) => void
  categoryFilter: CategoryFilter
  onCategoryFilterChange: (value: CategoryFilter) => void
  sortBy: SortOption
  onSortByChange: (value: SortOption) => void
  sortOrder: SortOrder
  onSortOrderChange: (value: SortOrder) => void
  onAiSummaryClick: () => void
  className?: string
}

/** 검색·필터·정렬 컨트롤을 제공한다. */
export const AppToolbar = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onAiSummaryClick,
  className,
}: AppToolbarProps) => {
  return (
    <div
      className={cn(
        "bg-muted/30 border-b px-4 py-3 sm:px-6",
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Label htmlFor="todo-search" className="sr-only">
            검색
          </Label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="todo-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제목 검색…"
            className="h-9 pl-9"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">상태</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[min(100vw-2rem,11rem)] min-w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="active">진행 중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="overdue">지연</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">우선순위</Label>
            <Select
              value={priorityFilter}
              onValueChange={(v) =>
                onPriorityFilterChange(v as "all" | TodoPriority)
              }
            >
              <SelectTrigger className="h-9 w-[min(100vw-2rem,11rem)] min-w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="high">{PRIORITY_LABEL.high}</SelectItem>
                <SelectItem value="medium">{PRIORITY_LABEL.medium}</SelectItem>
                <SelectItem value="low">{PRIORITY_LABEL.low}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">정렬</Label>
            <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortOption)}>
              <SelectTrigger className="h-9 w-[min(100vw-2rem,13rem)] min-w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">우선순위순</SelectItem>
                <SelectItem value="due_date">마감일순</SelectItem>
                <SelectItem value="created_at">생성일순</SelectItem>
                <SelectItem value="title">제목순</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">정렬 순서</Label>
            <Select value={sortOrder} onValueChange={(v) => onSortOrderChange(v as SortOrder)}>
              <SelectTrigger className="h-9 w-[min(100vw-2rem,11rem)] min-w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">오름차순</SelectItem>
                <SelectItem value="desc">내림차순</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">카테고리</Label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => onCategoryFilterChange(v as CategoryFilter)}
            >
              <SelectTrigger className="h-9 w-[min(100vw-2rem,11rem)] min-w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="업무">업무</SelectItem>
                <SelectItem value="개인">개인</SelectItem>
                <SelectItem value="학습">학습</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label className="text-muted-foreground text-xs">AI</Label>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[9rem] gap-1.5"
              onClick={onAiSummaryClick}
            >
              <Sparkles className="size-3.5" aria-hidden />
              AI 요약
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
