// 공용 유틸 함수 모음

export const OPEN_HOUR = 9; // 예약 가능 시작 시각
export const CLOSE_HOUR = 18; // 예약 가능 종료 시각 (이 시각까지 예약 가능, 이 시각 이후 슬롯 없음)

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// 09 -> "09:00"
export function hourLabel(hour) {
  return `${pad2(hour)}:00`;
}

// 09 -> "09:00:00" (DB time 컬럼 저장용)
export function hourToTimeValue(hour) {
  return `${pad2(hour)}:00:00`;
}

// "09:00:00" 또는 "09:00" -> "09:00"
export function formatTimeShort(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

// "09:00:00" -> 540 (분 단위)
export function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Date 객체를 로컬 기준 YYYY-MM-DD 문자열로 변환
export function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return toDateInputValue(new Date());
}

// 09시부터 17시까지 (마지막 슬롯은 17:00~18:00) 시간 슬롯 배열
export function timeSlots() {
  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h += 1) {
    slots.push(h);
  }
  return slots;
}

// 날짜 문자열을 "2026년 7월 14일 (화)" 형태로 표시
export function formatDateKorean(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

let toastTimer = null;

// 화면 하단에 잠깐 표시되는 토스트 메시지. #toast 엘리먼트가 있는 페이지에서 사용.
export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('error');
  if (type === 'error') toast.classList.add('error');
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
