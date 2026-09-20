const installButton = document.getElementById('install-app');
const installDialog = document.getElementById('install-dialog');
const updateButton = document.getElementById('update-app');
const standalone = window.matchMedia('(display-mode: standalone)');
let installPrompt, waitingWorker, reloadRequested = false;

function syncInstallButton() {
  installButton.hidden = standalone.matches || navigator.standalone === true;
}
syncInstallButton();
standalone.addEventListener('change', syncInstallButton);
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  syncInstallButton();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
  installDialog.close();
});
installButton.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installButton.hidden = true;
      return;
    } catch { /* Browser declined the prompt; offer manual instructions. */ }
  }
  installDialog.showModal();
});
document.getElementById('close-install').addEventListener('click', () => installDialog.close());

function offerUpdate(worker) {
  if (!worker) return;
  waitingWorker = worker;
  updateButton.hidden = false;
}
updateButton.addEventListener('click', () => {
  if (!waitingWorker) return;
  reloadRequested = true;
  updateButton.disabled = true;
  updateButton.textContent = '업데이트 중…';
  waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' });
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) window.location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
        });
      });
      await navigator.serviceWorker.ready;
      document.getElementById('offline-ready').textContent = '오프라인 플레이 준비 완료! 인터넷 없이도 즐길 수 있어요.';
    } catch {
      document.getElementById('offline-ready').textContent = '오프라인 저장을 완료하지 못했어요. 인터넷에 연결해 다시 열어 주세요.';
    }
  });
}
