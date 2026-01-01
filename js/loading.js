function initLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingStatus = document.getElementById('loading-status');
  if (!loadingScreen || !loadingStatus) return;

  const steps = [
    { text: t('loading_initializing'), delay: 0 },
    { text: t('loading_resources'), delay: 800 },
    { text: t('loading_rendering'), delay: 1600 },
    { text: t('loading_complete'), delay: 2400 }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      loadingStatus.textContent = step.text;
    }, step.delay);
  });

  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 3000);
}

function withLoader(container, loadFn, delay = 300) {
  if (!container || typeof loadFn !== 'function') {
    if (typeof loadFn === 'function') {
      loadFn();
    }
    return;
  }

  container.classList.add('with-loader');

  let overlay = container.querySelector('.loader-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loader-overlay';
    const spinner = document.createElement('div');
    spinner.className = 'loader-spinner';
    overlay.appendChild(spinner);
    container.appendChild(overlay);
  }

  overlay.classList.add('visible');

  setTimeout(() => {
    loadFn();
    setTimeout(() => {
      overlay.classList.remove('visible');
    }, 300);
  }, delay);
}

