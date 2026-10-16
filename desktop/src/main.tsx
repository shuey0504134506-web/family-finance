import './i18n/desktopEn';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyDocumentLang } from '../../src/i18n/lang';
import { DesktopApp } from './ui/DesktopApp';
import { installNativeFilePicker } from './ui/nativeFilePicker';
import '@fontsource/heebo/hebrew-300.css';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-500.css';
import '@fontsource/heebo/hebrew-600.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-500.css';
import '@fontsource/heebo/latin-600.css';
import '@fontsource/heebo/latin-700.css';
import '../../src/styles/index.css';
import './styles/desktop.css';

applyDocumentLang();
installNativeFilePicker();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
