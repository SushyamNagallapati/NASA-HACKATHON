(function () {
  const override = new URLSearchParams(location.search).get('backend');
  const PROD_BACKEND = 'https://YOUR-BACKEND.example.com';
  const LOCAL_BACKEND = 'http://localhost:4000';
  window.BACKEND_URL =
    override || (location.hostname.endsWith('github.io') ? PROD_BACKEND : LOCAL_BACKEND);
  console.log('[config] BACKEND_URL =', window.BACKEND_URL);
})();
