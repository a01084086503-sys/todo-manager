import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type ParsedTodoOutput = z.infer<typeof aiOutputSchema>;

const INPUT_MIN_LENGTH = 2;
const INPUT_MAX_LENGTH = 500;
const TITLE_MIN_LENGTH = 2;
const TITLE_MAX_LENGTH = 120;

/** 제어 문자를 제거하고 공백·대소문자를 정규화한다. */
const preprocessInput = (value: string): string => {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ko-KR");
};

/** 제목 길이를 안전 범위로 보정한다. */
const normalizeTitle = (title: string, fallbackInput: string): string => {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (normalized.length >= TITLE_MIN_LENGTH && normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }

  if (normalized.length > TITLE_MAX_LENGTH) {
    return normalized.slice(0, TITLE_MAX_LENGTH).trimEnd();
  }

  const fallback = fallbackInput.slice(0, TITLE_MAX_LENGTH).trim();
  if (fallback.length >= TITLE_MIN_LENGTH) {
    return fallback;
  }
  return "할 일";
};

/** 과거 날짜면 null로 보정하고 누락 필드를 기본값으로 채운다. */
const postprocessOutput = (
  output: ParsedTodoOutput,
  fallbackInput: string,
  now: Date,
): ParsedTodoOutput => {
  const result: ParsedTodoOutput = {
    title: normalizeTitle(output.title ?? "", fallbackInput),
    description: (output.description ?? "").trim(),
    due_date: output.due_date ?? null,
    due_time: output.due_time ?? null,
    priority: output.priority ?? "medium",
    category: Array.isArray(output.category) ? output.category.filter(Boolean) : [],
  };

  if (result.due_date) {
    const dueDateTime = new Date(
      `${result.due_date}T${result.due_time ?? "09:00"}:00+09:00`,
    );
    if (Number.isNaN(dueDateTime.getTime()) || dueDateTime.getTime() < now.getTime()) {
      result.due_date = null;
      result.due_time = null;
    }
  }

  return result;
};

const requestSchema = z.object({
  input: z
    .string()
    .transform((value) => preprocessInput(value))
    .pipe(
      z
        .string()
        .min(INPUT_MIN_LENGTH, "할 일 문장을 2자 이상 입력해 주세요.")
        .max(INPUT_MAX_LENGTH, "할 일 문장은 500자 이하로 입력해 주세요."),
    ),
});

const aiOutputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.array(z.string().trim().min(1)).default([]),
});

/** 시간 문자열이 비어 있거나 형식이 잘못되면 기본 시간을 반환한다. */
const normalizeDueTime = (dueTime: string | null) => {
  if (!dueTime) return "09:00";
  return /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : "09:00";
};

/** 자연어 할 일을 구조화된 데이터로 변환한다. */
export const POST = async (request: Request) => {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { message: "GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const parsedBody = requestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { message: parsedBody.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const now = new Date();
    const today = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const normalizedInput = parsedBody.data.input;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: aiOutputSchema,
      temperature: 0.1,
      system: [
        "당신은 한국어 자연어를 할 일 데이터로 정확히 구조화하는 도우미입니다.",
        "출력은 반드시 JSON 스키마를 지키고 추측을 최소화하세요.",
        `기준 날짜는 ${today} (Asia/Seoul) 입니다.`,
        "제목(title)은 짧고 명확하게 정리하세요.",
        "description은 필요한 경우에만 간결히 작성하세요.",
        "due_date는 YYYY-MM-DD, due_time은 HH:mm(24시간) 형식으로 반환하세요.",
        "=== 날짜 처리 규칙 ===",
        "- '오늘'은 기준 날짜와 동일한 날짜로 해석하세요.",
        "- '내일'은 기준 날짜 + 1일로 해석하세요.",
        "- '모레'는 기준 날짜 + 2일로 해석하세요.",
        "- '이번 주'는 기준 날짜가 속한 주에서 가장 가까운 금요일로 해석하세요.",
        "- '다음 주'는 다음 주의 월요일로 해석하세요.",
        "=== 시간 처리 규칙 ===",
        "- '아침'은 09:00",
        "- '점심'은 12:00",
        "- '오후'는 14:00",
        "- '저녁'은 18:00",
        "- '밤'은 21:00",
        "=== 우선순위 키워드 규칙 ===",
        "- high: 급하게, 중요한, 빨리, 꼭, 반드시",
        "- medium: 보통, 적당히, 또는 우선순위 키워드가 없는 일반 문장",
        "- low: 여유롭게, 천천히, 언젠가",
        "=== 카테고리 분류 키워드 규칙 ===",
        "- 업무: 회의, 보고서, 프로젝트, 업무",
        "- 개인: 쇼핑, 친구, 가족, 개인",
        "- 건강: 운동, 병원, 건강, 요가",
        "- 학습: 공부, 책, 강의, 학습",
        "카테고리는 매칭되는 키워드에 따라 배열로 반환하세요. 매칭이 없으면 빈 배열을 반환하세요.",
        "날짜가 추출되었는데 시간이 없으면 due_time은 반드시 09:00으로 설정하세요.",
        "날짜를 전혀 판단할 수 없으면 due_date와 due_time은 null로 설정하세요.",
        "priority는 문맥 중요도를 기준으로 high/medium/low 중 하나를 선택하세요.",
        "최종 출력에는 title, description, due_date, due_time, priority, category 필드만 포함하세요.",
      ].join("\n"),
      prompt: `사용자 입력: ${normalizedInput}`,
    });

    const processed = postprocessOutput(object, normalizedInput, now);
    const dueDate = processed.due_date;
    const dueTime = dueDate ? normalizeDueTime(processed.due_time) : null;

    return NextResponse.json(
      {
        title: processed.title,
        description: processed.description,
        due_date: dueDate,
        due_time: dueTime,
        priority: processed.priority,
        category: processed.category,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    const isRateLimit =
      message.includes("429") ||
      message.toLowerCase().includes("rate limit") ||
      message.toLowerCase().includes("quota");

    if (isRateLimit) {
      return NextResponse.json(
        { message: "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { message: `AI 변환 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
};
