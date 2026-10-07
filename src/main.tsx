import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installAndroidBackHandler } from './native/androidBack';
import './styles.css';

installAndroidBackHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
