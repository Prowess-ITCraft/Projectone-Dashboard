import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { ActorProvider } from './app/actor.jsx';
import { SessionProvider } from './app/session.jsx';
import { ApiProvider } from './data/api.jsx';
import { createFixtures } from './data/fixtures';
import { createHttpApi } from './data/http/httpApi.js';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/projects.css';
import './styles/auth.css';
import './styles/customers.css';
import './styles/work.css';

function start() {
  // The API is reached on the same address as the app (the dev server and the host forward /api), so the session
  // cookie stays first-party and is never readable by scripts.
  const api = createHttpApi({ fixtures: createFixtures(), baseUrl: import.meta.env.VITE_API_URL || '/api' });
  createRoot(document.getElementById('root')).render(
    <HashRouter>
      <ApiProvider api={api}>
        <SessionProvider>
          <ActorProvider>
            <App />
          </ActorProvider>
        </SessionProvider>
      </ApiProvider>
    </HashRouter>,
  );
}

start();
