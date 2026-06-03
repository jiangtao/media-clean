import React from 'react';
import { createRoot } from 'react-dom/client';

import { DesktopApp } from './App';
import { installDesktopPreviewBridge } from './dev-preview';
import './tailwind.css';
import './desktop.less';

installDesktopPreviewBridge();

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
);
