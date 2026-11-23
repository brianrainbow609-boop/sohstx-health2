const installButton = document.querySelector('#native-install');
const statusText = document.querySelector('#status');
let deferredPrompt;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  const event = deferredPrompt;
  deferredPrompt = null;
  installButton.hidden = true;
  await event.prompt();
  const choice = await event.userChoice;
  statusText.textContent = choice.outcome === 'accepted' ? 'Install request accepted.' : 'Install dismissed. You can still play in your browser.';
});
window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  statusText.textContent = 'Installed. Open the game from your home screen.';
});
