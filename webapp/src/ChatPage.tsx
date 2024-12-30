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
    const fetchMatrixData = async (token: string) => {
        try {
            if (!token) throw new Error('Access token is missing');
            const response = await fetch('https://app.codecollective.us/synapse', {
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
                const token = keycloak.token || '';
                await fetchMatrixData(token);
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
