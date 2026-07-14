// PWA 설치 배너 + 서비스워커 등록

const DISMISS_KEY = 'coroom_install_banner_dismissed_at';
const DISMISS_DAYS = 7;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isDismissedRecently() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const diffDays = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
  return diffDays < DISMISS_DAYS;
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등)은 조용히 무시
  }
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

let bannerEl = null;

function showInstallBanner({ message, actionLabel, onAction }) {
  if (bannerEl || isStandalone() || isDismissedRecently()) return;

  bannerEl = document.createElement('div');
  bannerEl.className = 'install-banner';
  bannerEl.innerHTML = `
    <span class="install-banner-icon" aria-hidden="true">📲</span>
    <p class="install-banner-text">${message}</p>
    <div class="install-banner-actions">
      ${actionLabel ? `<button type="button" class="btn primary install-banner-action">${actionLabel}</button>` : ''}
      <button type="button" class="install-banner-close" aria-label="닫기">×</button>
    </div>
  `;
  document.body.appendChild(bannerEl);

  const closeBtn = bannerEl.querySelector('.install-banner-close');
  closeBtn.addEventListener('click', hideInstallBanner);

  if (actionLabel) {
    const actionBtn = bannerEl.querySelector('.install-banner-action');
    actionBtn.addEventListener('click', async () => {
      hideInstallBanner();
      if (onAction) await onAction();
    });
  }

  requestAnimationFrame(() => bannerEl.classList.add('show'));
}

function hideInstallBanner() {
  if (!bannerEl) return;
  markDismissed();
  bannerEl.classList.remove('show');
  const el = bannerEl;
  bannerEl = null;
  setTimeout(() => el.remove(), 250);
}

// ---- Android/Chrome/Edge: beforeinstallprompt ----
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner({
    message: 'coroom을 홈 화면에 추가하고 앱처럼 빠르게 사용해보세요.',
    actionLabel: '설치',
    onAction: async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    },
  });
});

window.addEventListener('appinstalled', hideInstallBanner);

// ---- iOS Safari: beforeinstallprompt 미지원 → 수동 안내 ----
function maybeShowIosBanner() {
  if (isIos() && !isStandalone()) {
    showInstallBanner({
      message: '공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하면 앱처럼 설치할 수 있어요.',
      actionLabel: null,
    });
  }
}

document.addEventListener('DOMContentLoaded', maybeShowIosBanner);

// ---- 오프라인 상태 표시 ----
function updateOfflineIndicator() {
  const existing = document.getElementById('offline-indicator');
  if (!navigator.onLine) {
    if (!existing) {
      const bar = document.createElement('div');
      bar.id = 'offline-indicator';
      bar.className = 'offline-indicator';
      bar.textContent = '오프라인 상태예요. 마지막으로 불러온 화면을 보여드리고 있어요.';
      document.body.prepend(bar);
    }
  } else if (existing) {
    existing.remove();
  }
}

window.addEventListener('online', updateOfflineIndicator);
window.addEventListener('offline', updateOfflineIndicator);
document.addEventListener('DOMContentLoaded', updateOfflineIndicator);

// ---- 서비스워커 등록 (오프라인 지원) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('서비스워커 등록 실패:', err);
    });
  });
}
