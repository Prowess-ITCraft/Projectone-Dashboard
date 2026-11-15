import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { StoreProvider } from './store.jsx';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <HashRouter>
    <StoreProvider>
      <App />
    </StoreProvider>
  </HashRouter>,
);
