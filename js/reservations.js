import { supabase } from './supabaseClient.js';
import { formatTimeShort, showToast } from './utils.js';

let rooms = [];
let realtimeChannel = null;

const filterDate = document.getElementById('filter-date');
const filterRoom = document.getElementById('filter-room');
const filterDepartment = document.getElementById('filter-department');
const filterBooker = document.getElementById('filter-booker');
const filterShowCancelled = document.getElementById('filter-show-cancelled');
const filterApplyBtn = document.getElementById('filter-apply-btn');
const filterResetBtn = document.getElementById('filter-reset-btn');
const listBody = document.getElementById('reservation-list-body');

async function init() {
  await loadRooms();
  populateRoomOptions();

  filterApplyBtn.addEventListener('click', loadAndRender);
  filterShowCancelled.addEventListener('change', loadAndRender);
  filterResetBtn.addEventListener('click', () => {
    filterDate.value = '';
    filterRoom.value = '';
    filterDepartment.value = '';
    filterBooker.value = '';
    filterShowCancelled.checked = false;
    loadAndRender();
  });

  [filterDate, filterRoom, filterDepartment, filterBooker].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadAndRender();
    });
  });

  await loadAndRender();
  subscribeRealtime();
}

async function loadRooms() {
  const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  rooms = data || [];
}

function populateRoomOptions() {
  rooms.forEach((room) => {
    const opt = document.createElement('option');
    opt.value = room.id;
    opt.textContent = room.name;
    filterRoom.appendChild(opt);
  });
}

function roomName(roomId) {
  const room = rooms.find((r) => r.id === roomId);
  return room ? room.name : `회의실 ${roomId}`;
}

async function loadAndRender() {
  let query = supabase.from('reservations').select('*');

  if (filterDate.value) query = query.eq('reservation_date', filterDate.value);
  if (filterRoom.value) query = query.eq('room_id', Number(filterRoom.value));
  if (filterDepartment.value.trim()) query = query.ilike('department', `%${filterDepartment.value.trim()}%`);
  if (filterBooker.value.trim()) query = query.ilike('booker_name', `%${filterBooker.value.trim()}%`);
  if (!filterShowCancelled.checked) query = query.eq('status', 'confirmed');

  query = query
    .order('reservation_date', { ascending: false })
    .order('start_time', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error(error);
    showToast('예약 목록을 불러오지 못했습니다.', 'error');
    return;
  }

  renderList(data || []);
}

function renderList(list) {
  listBody.innerHTML = '';

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = '<td colspan="9">조건에 맞는 예약이 없습니다.</td>';
    listBody.appendChild(tr);
    return;
  }

  list.forEach((res) => {
    const tr = document.createElement('tr');
    if (res.status === 'cancelled') tr.classList.add('cancelled');

    const statusLabel = res.status === 'cancelled' ? '취소됨' : '확정';
    const statusClass = res.status === 'cancelled' ? 'cancelled' : 'confirmed';

    tr.innerHTML = `
      <td>${res.reservation_code ?? '-'}</td>
      <td>${roomName(res.room_id)}</td>
      <td>${res.reservation_date}</td>
      <td>${formatTimeShort(res.start_time)} - ${formatTimeShort(res.end_time)}</td>
      <td>${escapeHtml(res.booker_name)}</td>
      <td>${escapeHtml(res.department)}</td>
      <td>${escapeHtml(res.title)}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td></td>
    `;

    const actionTd = tr.querySelector('td:last-child');
    if (res.status === 'confirmed') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn danger';
      cancelBtn.type = 'button';
      cancelBtn.textContent = '취소';
      cancelBtn.addEventListener('click', () => onCancelReservation(res));
      actionTd.appendChild(cancelBtn);
    } else {
      actionTd.textContent = '-';
    }

    listBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function onCancelReservation(res) {
  const confirmed = window.confirm(`"${res.title}" 예약을 취소하시겠습니까?`);
  if (!confirmed) return;

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', res.id);

  if (error) {
    console.error(error);
    showToast('예약 취소 중 오류가 발생했습니다.', 'error');
    return;
  }

  showToast('예약이 취소되었습니다.');
  await loadAndRender();
}

function subscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel('reservations-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
      loadAndRender();
    })
    .subscribe();
}

init();
