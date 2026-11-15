import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App.jsx';
import { ActorProvider } from './app/actor.jsx';
import { ApiProvider } from './data/api.jsx';
import { createFixtures } from './data/fixtures';
import { createLocalApi } from './data/local/localApi.js';
import { createBrowserStorage } from './data/local/storage.js';
import { StoreProvider } from './store.jsx';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/projects.css';

function start() {
  const api = createLocalApi({ storage: createBrowserStorage(), fixtures: createFixtures() });
  createRoot(document.getElementById('root')).render(
    <HashRouter>
      <ApiProvider api={api}>
        <ActorProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </ActorProvider>
      </ApiProvider>
    </HashRouter>,
  );
}

start();
