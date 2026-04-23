import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  period: z.enum(["today", "week"]),
  todos: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        due_date: z.string().nullable(),
        priority: z.enum(["high", "medium", "low"]).nullable(),
        category: z.array(z.string()),
        completed: z.boolean(),
        created_at: z.string(),
      }),
    )
    .optional(),
});

const summarySchema = z.object({
  summary: z.string().min(1),
  urgentTasks: z.array(z.string()).default([]),
  insights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

type DbTodo = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low" | null;
  category: string[] | null;
  completed: boolean;
  created_at: string;
};

/** 서울 시간대를 기준으로 현재 시각을 반환한다. */
const getSeoulNow = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
};

/** 분석 기간의 시작/끝 시각을 계산한다. */
const getPeriodRange = (period: "today" | "week", base: Date) => {
  const start = new Date(base);
  const end = new Date(base);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: "오늘" as const };
  }

  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(base.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: "이번 주" as const };
};

/** 이전 비교 기간의 시작/끝 시각을 계산한다. */
const getPreviousPeriodRange = (period: "today" | "week", start: Date, end: Date) => {
  if (period === "today") {
    const prevStart = new Date(start);
    const prevEnd = new Date(end);
    prevStart.setDate(prevStart.getDate() - 1);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return { start: prevStart, end: prevEnd, label: "어제" as const };
  }

  const prevStart = new Date(start);
  const prevEnd = new Date(end);
  prevStart.setDate(prevStart.getDate() - 7);
  prevEnd.setDate(prevEnd.getDate() - 7);
  return { start: prevStart, end: prevEnd, label: "지난주" as const };
};

/** 할 일이 분석 범위에 포함되는지 판단한다. */
const isTodoInRange = (todo: DbTodo, start: Date, end: Date): boolean => {
  const baseDate = todo.due_date ?? todo.created_at;
  const parsed = new Date(baseDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
};

/** 시간대별 집중 분포를 계산한다. */
const getTimeBucketDistribution = (todos: DbTodo[]) => {
  const buckets = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
    unknown: 0,
  };

  todos.forEach((todo) => {
    if (!todo.due_date) {
      buckets.unknown += 1;
      return;
    }

    const hour = new Date(todo.due_date).getHours();
    if (Number.isNaN(hour)) {
      buckets.unknown += 1;
      return;
    }
    if (hour >= 6 && hour < 12) {
      buckets.morning += 1;
    } else if (hour >= 12 && hour < 18) {
      buckets.afternoon += 1;
    } else if (hour >= 18 && hour < 22) {
      buckets.evening += 1;
    } else {
      buckets.night += 1;
    }
  });

  return buckets;
};

/** 우선순위별 완료 패턴을 계산한다. */
const getPriorityCompletionPattern = (todos: DbTodo[]) => {
  return {
    high: {
      total: todos.filter((todo) => todo.priority === "high").length,
      completed: todos.filter((todo) => todo.priority === "high" && todo.completed).length,
    },
    medium: {
      total: todos.filter((todo) => todo.priority === "medium").length,
      completed: todos.filter((todo) => todo.priority === "medium" && todo.completed).length,
    },
    low: {
      total: todos.filter((todo) => todo.priority === "low").length,
      completed: todos.filter((todo) => todo.priority === "low" && todo.completed).length,
    },
  };
};

/** 마감일 준수율과 연기 패턴을 계산한다. */
const getDeadlineMetrics = (todos: DbTodo[]) => {
  const withDueDate = todos.filter((todo) => !!todo.due_date);
  const onTrack = withDueDate.filter(
    (todo) =>
      todo.completed || (todo.due_date ? new Date(todo.due_date).getTime() >= Date.now() : false),
  ).length;
  const delayed = withDueDate.filter(
    (todo) =>
      !todo.completed && !!todo.due_date && new Date(todo.due_date).getTime() < Date.now(),
  );

  const delayedCategoryCount: Record<string, number> = {};
  delayed.forEach((todo) => {
    (todo.category ?? []).forEach((category) => {
      delayedCategoryCount[category] = (delayedCategoryCount[category] ?? 0) + 1;
    });
  });

  return {
    withDueDateTotal: withDueDate.length,
    onTrack,
    complianceRate:
      withDueDate.length === 0 ? 0 : Number(((onTrack / withDueDate.length) * 100).toFixed(1)),
    delayedCount: delayed.length,
    delayedCategoryCount,
  };
};

/** 완료 항목 기준 생산적인 요일/시간대를 계산한다. */
const getProductivePattern = (todos: DbTodo[]) => {
  const completed = todos.filter((todo) => todo.completed);
  const weekdayCount: Record<string, number> = {};
  const hourCount: Record<string, number> = {};

  completed.forEach((todo) => {
    const base = new Date(todo.due_date ?? todo.created_at);
    if (Number.isNaN(base.getTime())) return;
    const weekday = base.toLocaleDateString("ko-KR", { weekday: "long" });
    const hour = `${base.getHours()}시`;
    weekdayCount[weekday] = (weekdayCount[weekday] ?? 0) + 1;
    hourCount[hour] = (hourCount[hour] ?? 0) + 1;
  });

  const mostProductiveWeekday =
    Object.entries(weekdayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "데이터 부족";
  const mostProductiveHour =
    Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "데이터 부족";

  return { mostProductiveWeekday, mostProductiveHour };
};

/** 완료가 쉬운 작업 특징과 자주 미루는 유형을 정리한다. */
const getWorkPatternHints = (todos: DbTodo[]) => {
  const delayed = todos.filter(
    (todo) =>
      !todo.completed && !!todo.due_date && new Date(todo.due_date).getTime() < Date.now(),
  );
  const easyCompleted = todos.filter(
    (todo) =>
      todo.completed &&
      (!todo.priority || todo.priority === "low" || (todo.title ?? "").trim().length <= 16),
  );

  return {
    postponedTaskTypes: delayed.map((todo) => ({
      title: todo.title,
      priority: todo.priority ?? "unknown",
      category: todo.category ?? [],
    })),
    easyTaskCommonTraits: {
      shortTitleCount: easyCompleted.filter((todo) => todo.title.trim().length <= 16).length,
      lowPriorityCount: easyCompleted.filter((todo) => todo.priority === "low").length,
      noDueDateCount: easyCompleted.filter((todo) => !todo.due_date).length,
    },
  };
};

/** AI가 읽기 쉬운 분석 컨텍스트를 구성한다. */
const buildAnalysisContext = (
  todos: DbTodo[],
  previousTodos: DbTodo[],
  label: "오늘" | "이번 주",
  previousLabel: "어제" | "지난주",
) => {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const completionRate = total === 0 ? 0 : Number(((completed / total) * 100).toFixed(1));
  const previousTotal = previousTodos.length;
  const previousCompleted = previousTodos.filter((todo) => todo.completed).length;
  const previousCompletionRate =
    previousTotal === 0 ? 0 : Number(((previousCompleted / previousTotal) * 100).toFixed(1));

  const overdue = todos.filter(
    (todo) => !todo.completed && !!todo.due_date && new Date(todo.due_date).getTime() < Date.now(),
  ).length;

  const priorityDistribution = {
    high: todos.filter((todo) => todo.priority === "high").length,
    medium: todos.filter((todo) => todo.priority === "medium").length,
    low: todos.filter((todo) => todo.priority === "low").length,
    unknown: todos.filter((todo) => !todo.priority).length,
  };
  const priorityCompletionPattern = getPriorityCompletionPattern(todos);
  const deadlineMetrics = getDeadlineMetrics(todos);
  const productivePattern = getProductivePattern(todos);
  const workPatternHints = getWorkPatternHints(todos);

  const timeDistribution = getTimeBucketDistribution(todos);
  const urgentTasks = todos
    .filter((todo) => !todo.completed && todo.priority === "high")
    .sort((a, b) => {
      const at = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    })
    .slice(0, 5)
    .map((todo) => todo.title);

  return {
    periodLabel: label,
    previousPeriodLabel: previousLabel,
    total,
    completed,
    completionRate,
    previousCompletionRate,
    completionRateDelta: Number((completionRate - previousCompletionRate).toFixed(1)),
    overdue,
    priorityDistribution,
    priorityCompletionPattern,
    deadlineMetrics,
    timeDistribution,
    productivePattern,
    workPatternHints,
    urgentTasks,
    todos: todos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      due_date: todo.due_date,
      priority: todo.priority ?? "unknown",
      category: todo.category ?? [],
    })),
  };
};

/** 사용자 할 일 목록을 분석해 요약/인사이트를 반환한다. */
export const POST = async (request: Request) => {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { message: "GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("todos")
      .select("id, title, description, due_date, priority, category, completed, created_at")
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    const rows: DbTodo[] = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      priority: row.priority,
      category: row.category ?? [],
      completed: row.completed,
      created_at: row.created_at,
    }));

    const now = getSeoulNow();
    const range = getPeriodRange(parsed.data.period, now);
    const previousRange = getPreviousPeriodRange(parsed.data.period, range.start, range.end);
    const periodTodos = rows.filter((todo) => isTodoInRange(todo, range.start, range.end));
    const previousPeriodTodos = rows.filter((todo) =>
      isTodoInRange(todo, previousRange.start, previousRange.end),
    );

    if (periodTodos.length === 0) {
      return NextResponse.json(
        {
          summary: `${range.label} 분석할 할 일이 아직 없습니다.`,
          urgentTasks: [],
          insights: [`${range.label}에는 등록된 할 일이 없어 여유가 있습니다.`],
          recommendations: ["간단한 목표 1~2개를 먼저 등록해 생산 리듬을 만들어 보세요."],
        },
        { status: 200 },
      );
    }

    const context = buildAnalysisContext(
      periodTodos,
      previousPeriodTodos,
      range.label,
      previousRange.label,
    );
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: summarySchema,
      temperature: 0.2,
      system: [
        "당신은 한국어로 친근하고 실행 가능한 할 일 코칭을 제공하는 생산성 분석가입니다.",
        "반드시 JSON 스키마를 지키고 한국어 자연스러운 문장으로 작성하세요.",
        "완료율 분석: 일일/주간 완료율, 우선순위별 완료 패턴, 이전 기간 대비 개선도를 반영하세요.",
        "시간 관리 분석: 마감일 준수율, 연기된 할 일 빈도/패턴, 시간대별 업무 집중도를 분석하세요.",
        "생산성 패턴: 가장 생산적인 요일/시간대, 자주 미루는 작업 유형, 완료하기 쉬운 작업 공통 특징을 반영하세요.",
        "실행 가능한 추천: 시간 관리 팁, 우선순위 조정, 일정 재배치, 과부하를 줄이는 분산 전략을 제안하세요.",
        "긍정적인 피드백: 잘하고 있는 점을 먼저 짚고, 개선점도 격려하는 톤으로 동기부여 메시지를 포함하세요.",
        "기간별 차별화: 오늘 요약은 당일 집중도와 남은 할 일 우선순위, 이번 주 요약은 주간 패턴과 다음 주 계획 제안을 강조하세요.",
        "insights는 2~4개, recommendations는 2~4개의 짧고 실천 가능한 문장으로 작성하세요.",
      ].join("\n"),
      prompt: `다음은 ${range.label} 할 일 분석 데이터입니다: ${JSON.stringify(context)}`,
    });

    return NextResponse.json(object, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    const lower = message.toLowerCase();
    const isRateLimit =
      message.includes("429") || lower.includes("rate limit") || lower.includes("quota");

    if (isRateLimit) {
      return NextResponse.json(
        { message: "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { message: `AI 요약 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
};
