# 📌 PRD (Product Requirements Document)
## AI 기반 할 일 관리 서비스

작성일: 2026-04-18

---

## 1. 📖 제품 개요

### 1.1 목적
사용자의 할 일 관리 효율을 극대화하기 위해 AI 기반 자동 생성, 요약 및 분석 기능을 제공하는 스마트 To-Do 관리 서비스 구축.

### 1.2 핵심 가치
- 간편한 입력 → AI 자동 구조화
- 직관적인 UI → 빠른 작업 관리
- 데이터 기반 분석 → 생산성 향상

---

## 2. 🎯 주요 기능

### 2.1 사용자 인증
- Supabase Auth 기반
- 이메일/비밀번호 회원가입 및 로그인
- 세션 관리 및 인증 상태 유지

---

### 2.2 할 일 관리 (CRUD)

#### 필드 정의
| 필드명 | 타입 | 설명 |
|--------|------|------|
| id | uuid | 고유 ID |
| user_id | uuid | 사용자 ID |
| title | text | 제목 |
| description | text | 설명 |
| created_at | timestamp | 생성일 |
| due_date | timestamp | 마감일 |
| priority | enum | high / medium / low |
| category | text[] | 카테고리 |
| completed | boolean | 완료 여부 |

#### 기능
- 할 일 생성
- 할 일 조회 (리스트)
- 할 일 수정
- 할 일 삭제

---

### 2.3 검색 / 필터 / 정렬

#### 검색
- 제목(title)과 설명(description) 모두를 대상으로 부분 일치 검색 수행
- 기본은 대소문자 비구분 검색

#### 필터
- 우선순위: 높음 / 중간 / 낮음
- 카테고리: 업무 / 개인 / 학습 등
- 상태:
  - 진행 중
  - 완료
  - 지연 (마감일 초과 & 미완료)

#### 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.4 AI 할 일 생성 기능

#### 설명
사용자의 자연어 입력을 구조화된 데이터로 변환

#### 입력 예시
"내일 오전 10시에 팀 회의 준비"

#### 출력 예시
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성하기",
  "created_at": "YYYY-MM-DD HH:MM",
  "due_date": "YYYY-MM-DD 10:00",
  "priority": "high",
  "category": ["업무"],
  "completed": false
}
```

#### 처리 로직
1. 사용자 입력 수신
2. AI API 호출 (Gemini)
3. JSON 파싱 및 검증
4. DB 저장

---

### 2.5 AI 요약 및 분석

#### 기능
- 일일 요약
  - 완료/미완료/지연 항목 구분 요약
  - 응답 시간 목표: 5초 이내

- 주간 요약
  - 완료율
  - 카테고리별 통계
  - 핵심 이슈 3개 제공

- 실패 처리
  - 요약 실패 시 "요약 생성에 실패했습니다. 다시 시도해 주세요." 메시지 표시
  - 재시도 버튼 제공

---

## 3. 🖥️ 화면 구성

### 3.1 로그인 / 회원가입 화면
- 이메일 입력
- 비밀번호 입력
- 로그인 / 회원가입 버튼

---

### 3.2 메인 할 일 관리 화면

#### 구성 요소
- 할 일 리스트
- 할 일 추가 버튼
- 검색창
- 필터 / 정렬 드롭다운
- AI 생성 입력창
- AI 요약 버튼

---

### 3.3 통계 및 분석 화면 (Phase 2)
- 본 기능은 MVP 범위에서 제외하며, 2차 릴리스에서 제공
- 주간 완료율 그래프
- 카테고리별 비율 차트
- 일별 활동량

---

## 4. ⚙️ 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js |
| 스타일링 | Tailwind CSS |
| UI 컴포넌트 | shadcn/ui |
| 백엔드 | Supabase |
| 인증 | Supabase Auth |
| 데이터베이스 | PostgreSQL (Supabase) |
| AI | Google Gemini API |

---

## 5. 🗄️ 데이터 구조

### 5.1 users
- 인증 원본은 auth.users 사용
- 프로필 확장이 필요할 경우에만 public.users를 1:1로 운영
- todos.user_id는 인증 사용자 ID와 동일 값을 참조

---

### 5.2 todos 테이블

```sql
create table todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  title text not null,
  description text,
  created_at timestamp default now(),
  due_date timestamp,
  priority text check (priority in ('high','medium','low')),
  category text[],
  completed boolean default false
);
```

---

## 6. 🔄 주요 사용자 흐름

1. 회원가입 / 로그인
2. 메인 화면 진입
3. 할 일 생성 (수동 or AI)
4. 리스트 관리 (검색/필터/정렬)
5. 완료 처리
6. AI 요약 확인

---

## 7. 🚀 확장 가능 기능

- 푸시 알림 (마감일 알림)
- 협업 기능 (공유 할 일)
- 캘린더 연동
- 모바일 앱 지원

---

## 8. 📊 성공 지표 (KPI)

- DAU / MAU
- 할 일 생성 수
- 완료율
- AI 기능 사용률

---

## 9. ⚠️ 고려 사항

- AI 응답 지연 → 로딩 UX 필요
- 데이터 정합성 검증
- 사용자별 데이터 분리 (RLS 적용)
- 보안 및 인증 강화

---

## 10. 📌 RLS 정책 (예시)

```sql
create policy "Users can manage their own todos"
on todos
for all
using (auth.uid() = user_id);
```

---

## 11. 🔗 문서 참조 가이드 (Cursor)

- 본 문서 참조 표준 경로는 @docs/PRD.md
- 예시 프롬프트: "@docs/PRD.md 기준으로 MVP 기능만 요약해 주세요."

---

# ✅ 결론
본 제품은 AI 기반 자동화 기능을 통해 기존 To-Do 앱 대비 높은 생산성과 편의성을 제공하는 것을 목표로 한다.
