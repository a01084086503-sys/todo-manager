import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  input: z
    .string()
    .trim()
    .min(2, "할 일 문장을 2자 이상 입력해 주세요.")
    .max(1000, "할 일 문장은 1000자 이하로 입력해 주세요."),
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

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: aiOutputSchema,
      temperature: 0.1,
      system: [
        "당신은 한국어 자연어를 할 일 데이터로 정확히 구조화하는 도우미입니다.",
        "반드시 스키마를 지키고 추측을 최소화하세요.",
        `기준 날짜는 ${today} (Asia/Seoul) 입니다.`,
        "제목(title)은 짧고 명확하게 정리하세요.",
        "description은 필요한 경우에만 간결히 작성하세요.",
        "due_date는 YYYY-MM-DD, due_time은 HH:mm(24시간) 형식으로 반환하세요.",
        "날짜가 추출되었는데 시간이 없으면 due_time은 반드시 09:00으로 설정하세요.",
        "날짜를 전혀 판단할 수 없으면 due_date와 due_time은 null로 설정하세요.",
        "priority는 문맥 중요도를 기준으로 high/medium/low 중 하나를 선택하세요.",
        "category는 문맥 기반 짧은 단어 배열로 반환하세요. 없으면 빈 배열을 반환하세요.",
      ].join("\n"),
      prompt: `사용자 입력: ${parsedBody.data.input}`,
    });

    const dueDate = object.due_date;
    const dueTime = dueDate ? normalizeDueTime(object.due_time) : null;

    return NextResponse.json(
      {
        title: object.title,
        description: object.description,
        due_date: dueDate,
        due_time: dueTime,
        priority: object.priority,
        category: object.category,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { message: `AI 변환 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
};
