import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import MkuuRoot from './MkuuRoot.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MkuuRoot />
  </StrictMode>,
);
