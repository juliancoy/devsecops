// src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Feed from './Feed';
//import SignIn from './SignIn';
import Privacy from './Privacy';
import Profile from './Profile';
import ChatPage from './ChatPage';
import Settings from './Settings';
//import VideoRoom from './VideoRoom';
//import AIView from './AIView';
//import AICompute from './AICompute';
import Events from './Events';
import TDF from './TDF';
import './App.css';
import Bluesky from './Bluesky';

interface AppRoutesProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ darkMode, onToggleDarkMode }) => {
    return (
        <div id="fullpage" className={darkMode ? 'dark-mode' : ''}>
            <Navbar />
            <button onClick={onToggleDarkMode}>
                Toggle to {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <Routes>
                <Route path="/" element={<Feed />} /> {/* Home route for the feed */}
                <Route path="/privacy" element={<Privacy />} /> {/* Privacy page route */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/events" element={<Events />} />
                <Route path="/navbar" element={<Navbar />} />
                <Route path="/tdf" element={<TDF />} />
                {/*<Route path="/video" element={<VideoRoom />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/aiview" element={<AIView />} />
                <Route path="/aicompute" element={<AICompute />} /> */}
            </Routes>
        </div>
    );
};

export default AppRoutes;
