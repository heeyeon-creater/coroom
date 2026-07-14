import { supabase } from './supabaseClient.js';
import {
  CLOSE_HOUR,
  hourLabel,
  hourToTimeValue,
  formatTimeShort,
  toMinutes,
  todayStr,
  timeSlots,
  formatDateKorean,
  showToast,
} from './utils.js';

// ---- 상태 ----
let rooms = [];
let reservations = []; // 선택한 날짜의 confirmed 예약 목록
let currentDate = todayStr();
let realtimeChannel = null;

// ---- DOM 참조 ----
const datePicker = document.getElementById('date-picker');
const dateLabel = document.getElementById('date-label');
const gridHeadRow = document.getElementById('grid-head-row');
const gridBody = document.getElementById('grid-body');

const popover = document.getElementById('room-popover');
const popoverTitle = document.getElementById('popover-title');
const popoverCapacity = document.getElementById('popover-capacity');
const popoverFloor = document.getElementById('popover-floor');
const popoverEquipment = document.getElementById('popover-equipment');
const popoverNote = document.getElementById('popover-note');

const modal = document.getElementById('reservation-modal');
const modalSubInfo = document.getElementById('modal-sub-info');
const reservationForm = document.getElementById('reservation-form');
const fieldRoomId = document.getElementById('field-room-id');
const fieldDate = document.getElementById('field-date');
const fieldStartTime = document.getElementById('field-start-time');
const fieldStartDisplay = document.getElementById('field-start-display');
const fieldEndTime = document.getElementById('field-end-time');
const fieldBooker = document.getElementById('field-booker');
const fieldDepartment = document.getElementById('field-department');
const fieldTitle = document.getElementById('field-title');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// ---- 초기화 ----
async function init() {
  datePicker.value = currentDate;
  updateDateLabel();

  await loadRooms();
  renderHead();
  await loadReservations();
  renderGrid();
  subscribeRealtime();

  datePicker.addEventListener('change', onDateChange);
  document.addEventListener('click', onDocumentClick);
  modalCancelBtn.addEventListener('click', () => modal.close());
  reservationForm.addEventListener('submit', onSubmitReservation);
}

function updateDateLabel() {
  dateLabel.textContent = formatDateKorean(currentDate);
}

async function loadRooms() {
  const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true });
  if (error) {
    console.error(error);
    showToast('회의실 정보를 불러오지 못했습니다.', 'error');
    return;
  }
  rooms = data || [];
}

async function loadReservations() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('reservation_date', currentDate)
    .eq('status', 'confirmed');
  if (error) {
    console.error(error);
    showToast('예약 현황을 불러오지 못했습니다.', 'error');
    return;
  }
  reservations = data || [];
}

async function onDateChange() {
  currentDate = datePicker.value || todayStr();
  updateDateLabel();
  await loadReservations();
  renderGrid();
  subscribeRealtime();
}

// ---- 그리드 렌더링 ----
function renderHead() {
  // 시간 열 헤더는 이미 HTML에 있음, 회의실 헤더 추가
  gridHeadRow.innerHTML = '<th class="time-col">시간</th>';
  rooms.forEach((room) => {
    const th = document.createElement('th');
    const btn = document.createElement('button');
    btn.className = 'room-name-btn';
    btn.type = 'button';
    btn.textContent = room.name;
    btn.dataset.roomId = room.id;
    btn.addEventListener('click', (e) => onRoomNameClick(e, room));
    th.appendChild(btn);
    if (room.note) {
      const badge = document.createElement('span');
      badge.className = 'room-note-badge';
      badge.textContent = '안내';
      th.appendChild(badge);
    }
    const meta = document.createElement('div');
    meta.className = 'room-meta';
    meta.textContent = `${room.floor} · ${room.capacity}인`;
    th.appendChild(meta);
    gridHeadRow.appendChild(th);
  });
}

// 회의실별로 해당 날짜의 시간대 커버리지를 계산
// grid[roomId][hour] = { type: 'reserved', reservation, span } | { type: 'covered' } | undefined(예약가능)
function buildGridState() {
  const slots = timeSlots();
  const state = {};
  rooms.forEach((room) => {
    state[room.id] = {};
  });

  reservations.forEach((res) => {
    const roomState = state[res.room_id];
    if (!roomState) return;
    const startMin = toMinutes(res.start_time);
    const endMin = toMinutes(res.end_time);
    const startHour = Math.floor(startMin / 60);
    const endHour = Math.floor(endMin / 60);
    const span = Math.max(1, endHour - startHour);

    if (!slots.includes(startHour)) return;

    roomState[startHour] = { type: 'reserved', reservation: res, span };
    for (let h = startHour + 1; h < startHour + span; h += 1) {
      roomState[h] = { type: 'covered' };
    }
  });

  return state;
}

function renderGrid() {
  const slots = timeSlots();
  const gridState = buildGridState();
  const isToday = currentDate === todayStr();
  const nowHour = new Date().getHours();

  gridBody.innerHTML = '';

  slots.forEach((hour) => {
    const tr = document.createElement('tr');

    const timeTh = document.createElement('th');
    timeTh.className = 'time-label';
    timeTh.textContent = hourLabel(hour);
    tr.appendChild(timeTh);

    rooms.forEach((room) => {
      const cellState = gridState[room.id][hour];
      if (cellState && cellState.type === 'covered') {
        return; // 이전 rowspan 셀에 병합됨
      }

      const td = document.createElement('td');
      td.className = 'slot-cell';

      if (cellState && cellState.type === 'reserved') {
        td.rowSpan = cellState.span;
        const box = document.createElement('div');
        box.className = 'slot reserved';
        const title = document.createElement('div');
        title.className = 'res-title';
        title.textContent = cellState.reservation.title;
        const sub = document.createElement('div');
        sub.className = 'res-sub';
        sub.textContent = `${cellState.reservation.booker_name} · ${cellState.reservation.department}`;
        const time = document.createElement('div');
        time.className = 'res-sub';
        time.textContent = `${formatTimeShort(cellState.reservation.start_time)} - ${formatTimeShort(cellState.reservation.end_time)}`;
        box.appendChild(title);
        box.appendChild(sub);
        box.appendChild(time);
        box.title = `${cellState.reservation.title} (${cellState.reservation.booker_name}, ${cellState.reservation.department})`;
        td.appendChild(box);
      } else {
        const isPast = isToday && hour <= nowHour;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isPast ? 'slot past' : 'slot';
        btn.textContent = isPast ? '마감' : '예약 가능';
        btn.disabled = isPast;
        if (!isPast) {
          btn.addEventListener('click', () => openReservationModal(room, hour));
        } else {
          btn.title = '지난 시간은 예약할 수 없습니다.';
        }
        td.appendChild(btn);
      }

      tr.appendChild(td);
    });

    gridBody.appendChild(tr);
  });
}

// ---- 회의실 정보 팝오버 ----
function onRoomNameClick(e, room) {
  e.stopPropagation();
  const rect = e.currentTarget.getBoundingClientRect();
  popoverTitle.textContent = room.name;
  popoverCapacity.textContent = `${room.capacity}명`;
  popoverFloor.textContent = room.floor;
  popoverEquipment.textContent = (room.equipment || []).join(', ') || '-';

  if (room.note) {
    popoverNote.textContent = `안내: ${room.note}`;
    popoverNote.style.display = 'block';
  } else {
    popoverNote.style.display = 'none';
  }

  popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
  popover.style.left = `${Math.max(8, rect.left + window.scrollX - 40)}px`;
  popover.classList.add('open');
}

function onDocumentClick(e) {
  if (popover.classList.contains('open') && !popover.contains(e.target) && !e.target.classList.contains('room-name-btn')) {
    popover.classList.remove('open');
  }
}

// ---- 빠른 예약 모달 ----
function openReservationModal(room, hour) {
  fieldRoomId.value = room.id;
  fieldDate.value = currentDate;
  fieldStartTime.value = hourToTimeValue(hour);
  fieldStartDisplay.value = hourLabel(hour);
  modalSubInfo.textContent = `${room.name} · ${formatDateKorean(currentDate)}`;

  // 종료시각 옵션: 시작시각 다음 시간부터 마감시각까지, 1시간 단위
  fieldEndTime.innerHTML = '';
  for (let h = hour + 1; h <= CLOSE_HOUR; h += 1) {
    const opt = document.createElement('option');
    opt.value = hourToTimeValue(h);
    opt.textContent = hourLabel(h);
    fieldEndTime.appendChild(opt);
  }

  fieldBooker.value = '';
  fieldDepartment.value = '';
  fieldTitle.value = '';

  modal.showModal();
}

async function onSubmitReservation(e) {
  e.preventDefault();

  const payload = {
    room_id: Number(fieldRoomId.value),
    reservation_date: fieldDate.value,
    start_time: fieldStartTime.value,
    end_time: fieldEndTime.value,
    booker_name: fieldBooker.value.trim(),
    department: fieldDepartment.value.trim(),
    title: fieldTitle.value.trim(),
  };

  if (!payload.booker_name || !payload.department || !payload.title) {
    showToast('모든 항목을 입력해주세요.', 'error');
    return;
  }

  const submitBtn = document.getElementById('modal-submit-btn');
  submitBtn.disabled = true;

  const { error } = await supabase.from('reservations').insert(payload);

  submitBtn.disabled = false;

  if (error) {
    console.error(error);
    modal.close();
    if (error.code === '23P01') {
      showToast('이미 예약된 시간입니다.', 'error');
    } else {
      showToast('예약 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
    await loadReservations();
    renderGrid();
    return;
  }

  modal.close();
  showToast('예약이 완료되었습니다.');
  await loadReservations();
  renderGrid();
}

// ---- 실시간 동기화 ----
function subscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel(`reservations-dashboard-${currentDate}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations',
        filter: `reservation_date=eq.${currentDate}`,
      },
      async () => {
        await loadReservations();
        renderGrid();
      },
    )
    .subscribe();
}

init();
