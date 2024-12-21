import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { createRoot } from 'react-dom/client';
import Keycloak from 'keycloak-js';
import { ReactKeycloakProvider } from '@react-keycloak/web';

// Keycloak instance
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_SERVER_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());

    // Wait for DOM elements and apply styles to '.feed-item'
    const applyDarkModeToFeedItems = () => {
      const feedItems = document.querySelectorAll('.feed-item');
      feedItems.forEach((item) => {
        item.classList.toggle('dark-mode', darkMode);
      });
    };

    // Use MutationObserver to ensure the elements exist and apply styles dynamically
    const observer = new MutationObserver(applyDarkModeToFeedItems);
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial call to apply styles
    applyDarkModeToFeedItems();

    return () => observer.disconnect();
  }, [darkMode]);

  return (
    <ReactKeycloakProvider authClient={keycloak}>
      <Router>
        <AppRoutes darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />
      </Router>
    </ReactKeycloakProvider>
  );
};

// Render the App
createRoot(document.getElementById('root')!).render(<App />);
export default App;
