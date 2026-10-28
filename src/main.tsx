import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyDocumentLang } from './i18n/lang';
import { Capacitor } from '@capacitor/core';
import { installAndroidBackHandler } from './native/androidBack';
import { installQuickActions } from './native/quickActions';
import { captureInstallPrompt } from './native/installPrompt';
import { installLockGuards } from './services/lockSuppress';
import '@fontsource/heebo/hebrew-300.css';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-500.css';
import '@fontsource/heebo/hebrew-600.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-300.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-500.css';
import '@fontsource/heebo/latin-600.css';
import '@fontsource/heebo/latin-700.css';
import './styles/index.css';

applyDocumentLang();
installAndroidBackHandler();
installQuickActions();
captureInstallPrompt();
installLockGuards();

// באתר (לא באפליקציית האנדרואיד, שבה הקבצים כבר בתוך ה-APK): service worker לפתיחה בלי אינטרנט.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  void import('./native/autoRefresh').then(({ startAutoRefresh }) => startAutoRefresh());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
