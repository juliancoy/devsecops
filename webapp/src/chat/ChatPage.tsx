import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import '../css/ChatPage.css';
import { Sidebar } from '../Sidebar';
import { Chat } from './Chat';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';

const ChatPage: React.FC = () => {
    const people = [
        { id: '1', firstName: 'Julian', lastName: 'Loiacono', attributes: { picture: ['https://example.com/profile1.jpg'] } },
        { id: '2', firstName: 'Alex', lastName: 'Smith', attributes: { picture: ['https://example.com/profile2.jpg'] } },
        { id: '3', firstName: 'Taylor', lastName: 'Doe', attributes: { picture: ['https://example.com/profile3.jpg'] } },
    ];

    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [selectedPerson, setSelectedPerson] = useState('Llama');
    const [conversations, setConversations] = useState<{ [key: string]: string[] }>({ Llama: [] });
    const [showChat, setShowChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rooms, setRooms] = useState<any[]>([]);

    const accessTokenRef = useRef<string | null>(null); // Persist accessToken across renders
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const fetchMatrixData = async (token: string) => {
        const roomsResponse = await fetch(`${synapseBaseUrl}/_matrix/client/r0/joined_rooms`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!roomsResponse.ok) throw new Error('Failed to fetch joined rooms');
        const roomsData = await roomsResponse.json();
        setRooms(roomsData.joined_rooms || []);
    };

    useEffect(() => {
        const initialize = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const loginToken = urlParams.get('loginToken');
            const storedAccessToken = localStorage.getItem('matrixAccessToken');

            try {
                if (loginToken) {
                    // Exchange login token for access token and fetch rooms
                    const token = await fetch(`${synapseBaseUrl}/_matrix/client/r0/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'm.login.token',
                            token: loginToken,
                        }),
                    })
                        .then((res) => {
                            if (!res.ok) throw new Error('Failed to exchange login token');
                            return res.json();
                        })
                        .then((data) => data.access_token);

                    accessTokenRef.current = token;
                    localStorage.setItem('matrixAccessToken', token);
                    await fetchMatrixData(token);
                } else if (storedAccessToken) {
                    // Use stored token to fetch rooms
                    accessTokenRef.current = storedAccessToken;
                    await fetchMatrixData(storedAccessToken);
                } else {
                    // No token found, redirect to auth
                    navigate('/chatauth');
                }
                setLoading(false);
            } catch (err) {
                console.error('Initialize error:', err);
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
                setLoading(false);
            }
        };

        initialize();
    }, [navigate, synapseBaseUrl]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        setConversations((prev) => ({
            ...prev,
            [selectedPerson]: [...prev[selectedPerson], `You: ${prompt}`],
        }));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handlePersonSelect = (person: string) => {
        setSelectedPerson(person);
        setShowChat(true);
    };

    const isMobile = window.innerWidth <= 768;

    if (loading) return <div>Loading data...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div id="app-container">
            {(!isMobile || !showChat) && (
                <Sidebar people={people} selectedPerson={selectedPerson} onPersonSelect={handlePersonSelect} />
            )}
            {isMobile && showChat && (
                <div className="chat-window active">
                    <div className="back-button" onClick={() => setShowChat(false)}>← Back</div>
                    <Chat
                        prompt={prompt}
                        setPrompt={setPrompt}
                        handleSubmit={handleSubmit}
                        handleKeyDown={handleKeyDown}
                        conversations={conversations[selectedPerson]}
                    />
                </div>
            )}
            {!isMobile && (
                <Chat
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleSubmit={handleSubmit}
                    handleKeyDown={handleKeyDown}
                    conversations={conversations[selectedPerson]}
                />
            )}
            <div>
                <h2>Joined Rooms:</h2>
                <ul>
                    {rooms.map((room) => (
                        <li key={room}>{room}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ChatPage;
