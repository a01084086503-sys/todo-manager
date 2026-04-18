import type { Todo } from "@/components/todo/types"

export const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001"

export const MOCK_USER = {
  id: MOCK_USER_ID,
  email: "demo@example.com",
  displayName: "데모 사용자",
}

const now = new Date()

export const INITIAL_MOCK_TODOS: Todo[] = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    user_id: MOCK_USER_ID,
    title: "팀 회의 준비",
    description: "내일 오전 회의 자료 정리 및 공유",
    created_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
    due_date: new Date(now.getTime() + 86400000).toISOString(),
    priority: "high",
    category: ["업무"],
    completed: false,
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    user_id: MOCK_USER_ID,
    title: "운동 30분",
    description: null,
    created_at: new Date(now.getTime() - 86400000).toISOString(),
    due_date: new Date(now.getTime() - 3600000).toISOString(),
    priority: "medium",
    category: ["개인"],
    completed: false,
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    user_id: MOCK_USER_ID,
    title: "React 문서 읽기",
    description: "Server Components 섹션",
    created_at: new Date(now.getTime() - 3600000).toISOString(),
    due_date: null,
    priority: "low",
    category: ["학습"],
    completed: false,
  },
  {
    id: "a1b2c3d4-0004-4000-8000-000000000004",
    user_id: MOCK_USER_ID,
    title: "장보기",
    description: "우유, 계란",
    created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
    due_date: new Date(now.getTime() - 86400000 * 2).toISOString(),
    priority: "low",
    category: ["개인"],
    completed: true,
  },
]
