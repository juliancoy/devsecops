import React, { useState, useEffect, KeyboardEvent } from 'react';
import './ChatPage.css';
import { Sidebar } from './Sidebar';
import { Chat } from './Chat';
import { useKeycloak } from '@react-keycloak/web';

const ChatPage: React.FC = () => {
    const { keycloak, initialized } = useKeycloak();
    const [prompt, setPrompt] = useState('');
    const [selectedPerson, setSelectedPerson] = useState('Llama');
    const [conversations, setConversations] = useState<{ [key: string]: string[] }>({
        Llama: [],
    });
    const [showChat, setShowChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [people, setPeople] = useState<User[]>([]);
    const [error, setError] = useState<string | null>(null);
    const joined_rooms_url = `${import.meta.env.VITE_SYNAPSE_BASE_URL}/_matrix/client/r0/joined_rooms`

    const refreshAccessToken = async () => {
        if (!keycloak.refreshToken) {
            throw new Error('Refresh token is missing.');
        }
    
        await keycloak.updateToken(30); // Refresh the token if it's about to expire in 30 seconds
        return keycloak.token;
    };
    
    const fetchMatrixData = async () => {
        try {

            let token = keycloak.token || '';
            
            // Refresh token if necessary
            token = await refreshAccessToken();
            console.log(token);
            
            console.log(joined_rooms_url);

            const response = await fetch(joined_rooms_url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
    
            const contentType = response.headers.get('Content-Type');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error fetching data: ${response.statusText} - ${errorText}`);
            }
    
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('Matrix Data:', result);
            } else {
                const text = await response.text();
                console.error('Unexpected response:', text);
                throw new Error('Received a non-JSON response from the server.');
            }
        } catch (err: any) {
            console.error('Error fetching Matrix data:', err);
            setError(err?.message || 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    };    
    
    useEffect(() => {
        const initialize = async () => {
            if (initialized) {
                
                await fetchMatrixData();
            }
        };

        initialize();
    }, [initialized, keycloak.token]);

    // Handle message submission
    const handleSubmit = async () => {
        if (!prompt.trim()) return;

        setConversations((prevConversations) => ({
            ...prevConversations,
            [selectedPerson]: [
                ...prevConversations[selectedPerson],
                `You: ${prompt}`,
            ],
        }));

        // Additional logic for API calls can be added here
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
                <Sidebar
                    people={people}
                    selectedPerson={selectedPerson}
                    onPersonSelect={handlePersonSelect}
                    className={`sidebar ${!isMobile || !showChat ? 'active' : ''}`}
                />
            )}
            {(isMobile && showChat) && (
                <div className="chat-window active">
                    <div className="back-button" onClick={() => setShowChat(false)}>
                        ← Back
                    </div>
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
                    className="chat-window"
                />
            )}
        </div>
    );
};

export default ChatPage;
