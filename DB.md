# DB.md — coroom Supabase 연동 정보

## 1. 프로젝트 연결 정보

- Supabase 프로젝트: **spacex** (기존 프로젝트를 coroom 용으로 함께 사용)
- Project ID: `ljjdlfygyzbeqfdntwpt`
- Project URL: `https://ljjdlfygyzbeqfdntwpt.supabase.co`
- Publishable (anon) key: `sb_publishable_Puh78xYJOVuqhnI32I5qZw_n89dBeBH`
  - 레거시 anon(JWT) 키도 사용 가능하지만 신규 프로젝트는 `sb_publishable_...` 키 사용 권장
- 프론트엔드에서는 이 URL + publishable key로 Supabase JS client(`@supabase/supabase-js`)를 초기화해서 사용

> 이 프로젝트에는 coroom과 무관한 기존 테이블(`public.pages`)이 이미 존재합니다. `rooms`, `reservations` 테이블만 coroom 소관이며, `pages` 테이블은 건드리지 않습니다.

## 2. 스키마 (이미 적용 완료)

### `rooms`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | smallint (PK) | 1~6 |
| name | text | 회의실명 |
| capacity | int | 수용인원 |
| floor | text | 층 |
| equipment | text[] | 보유장비 배열 |
| note | text (nullable) | 비고 |

시드 데이터 (엑셀 `회의실목록` 기준으로 이미 insert 완료):

| id | name | capacity | floor | equipment | note |
|---|---|---|---|---|---|
| 1 | 1번 회의실 (소회의실 A) | 4 | 3층 | {TV, 화이트보드} | |
| 2 | 2번 회의실 (소회의실 B) | 4 | 3층 | {TV, 화이트보드} | |
| 3 | 3번 회의실 (중회의실 A) | 8 | 3층 | {빔프로젝터, 화상회의 카메라} | |
| 4 | 4번 회의실 (중회의실 B) | 8 | 4층 | {빔프로젝터, 화이트보드} | |
| 5 | 5번 회의실 (대회의실) | 16 | 4층 | {빔프로젝터, 화상회의 카메라, 음향시설} | 임원 보고용 우선 배정 |
| 6 | 6번 회의실 (스튜디오) | 6 | 4층 | {방음시설, 녹화시설} | 면접/촬영 겸용 |

### `reservations`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK, default gen_random_uuid()) | |
| reservation_code | text (unique, default 자동생성) | 표시용 코드, `'B' \|\| YYYYMM \|\| 시퀀스번호` 형태로 자동 생성됨. INSERT 시 지정하지 않아도 됨 |
| room_id | smallint (FK → rooms.id) | |
| booker_name | text | 예약자명 |
| department | text | 부서 |
| title | text | 회의 제목 |
| reservation_date | date | 예약일자 |
| start_time | time | 시작시각 |
| end_time | time | 종료시각 (start_time보다 커야 함, DB에서 체크) |
| status | text (`confirmed` \| `cancelled`) | 기본값 `confirmed` |
| created_at | timestamptz (default now()) | |

**중복 예약 방지**: `status='confirmed'`인 건에 한해 동일 `room_id` + `reservation_date`에서 시간 구간이 겹치는 INSERT/UPDATE는 DB의 EXCLUDE 제약(`btree_gist` + 커스텀 `timerange` 타입)에 의해 거부됩니다. 겹치는 시간대에 예약을 시도하면 Postgres 에러(23P01, exclusion_violation)가 반환되므로, 프론트엔드는 이 에러를 잡아서 "이미 예약된 시간입니다" 같은 안내 메시지로 변환해야 합니다.

## 3. RLS (Row Level Security) 정책

MVP는 **로그인 없이** 이름/부서를 직접 입력하는 방식이므로, `anon` 역할에 대해 다음과 같이 열어두었습니다:

- `rooms`: 누구나 SELECT 가능
- `reservations`: 누구나 SELECT / INSERT / UPDATE 가능 (취소는 `status`를 `cancelled`로 UPDATE하는 방식)
- DELETE 정책은 없음 → 예약은 삭제하지 않고 상태만 변경해서 이력을 보존

> 보안 참고: 인증이 없는 내부용 MVP이므로 이 정책은 "사내망/사내 링크 접근" 전제 하에만 적정합니다. 추후 로그인 도입 시 RLS를 `auth.uid()` 기반으로 좁혀야 합니다 (PRD.md 12장 로드맵 참고).

## 4. MVP 정책 확정 사항 (PRD.md 9장 Open Questions에 대한 결정)

| 이슈 | 결정 |
|---|---|
| 로그인 여부 | MVP는 로그인 없이 이름/부서 텍스트 직접 입력 |
| 5번/6번 회의실 특수 배정 | 시스템 제약 없음, `note` 필드 문구만 UI에 안내 표시 |
| 예약 가능 시간대 | 09:00 ~ 18:00 |
| 최소 예약 단위 | 1시간 (그리드도 1시간 슬롯 기준) |
| 취소 권한 | 제한 없음 — 예약 목록에서 누구나 취소 가능 (내부 신뢰 기반 도구) |
| 동시성 처리 | DB EXCLUDE 제약이 최종 방어선. 동시 클릭 시 나중 요청은 23P01 에러 → "이미 예약되었습니다" 안내 후 화면 새로고침 |

## 5. 클라이언트 사용 예시

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ljjdlfygyzbeqfdntwpt.supabase.co',
  'sb_publishable_Puh78xYJOVuqhnI32I5qZw_n89dBeBH'
)

// 특정 날짜의 확정 예약 조회
const { data, error } = await supabase
  .from('reservations')
  .select('*')
  .eq('reservation_date', '2026-07-14')
  .eq('status', 'confirmed')

// 실시간 구독 (같은 날짜 그리드에 반영)
supabase
  .channel('reservations-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, payload => {
    // 그리드 다시 그리기
  })
  .subscribe()
```
