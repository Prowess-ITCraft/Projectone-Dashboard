import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { ActorProvider } from './app/actor.jsx';
import { SessionProvider } from './app/session.jsx';
import { ApiProvider } from './data/api.jsx';
import { createFixtures } from './data/fixtures';
import { createLocalApi } from './data/local/localApi.js';
import { createBrowserStorage } from './data/local/storage.js';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/projects.css';
import './styles/auth.css';
import './styles/customers.css';

function start() {
  const api = createLocalApi({ storage: createBrowserStorage(), fixtures: createFixtures() });
  createRoot(document.getElementById('root')).render(
    <HashRouter>
      <ApiProvider api={api}>
        <ActorProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </ActorProvider>
      </ApiProvider>
    </HashRouter>,
  );
}

start();
