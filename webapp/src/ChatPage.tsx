import React, { useState, useEffect, KeyboardEvent } from 'react';
import './ChatPage.css';
import { Sidebar } from './Sidebar';
import { Chat } from './Chat';
import { useKeycloak } from '@react-keycloak/web';
import { fetchKeycloakUsers } from './orgBackendUtils';

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

    useEffect(() => {
        const fetchUsers = async (token: string) => {
            try {
                if (!token) throw new Error('Access token is missing');
    
                const response = await fetchKeycloakUsers(token);
                if (!response?.users) throw new Error('Invalid response format');
    
                const users = response.users;
    
                setPeople(users); // Directly set the fetched users
                setConversations((prevConversations) => {
                    const newConversations = { ...prevConversations };
                    users.forEach((user) => {
                        if (!newConversations[user.id]) {
                            newConversations[user.id] = [];
                        }
                    });
                    return newConversations;
                });
                setLoading(false);
            } catch (err: any) {
                console.error('Error fetching users:', err);
                console.error('Error details:', JSON.stringify(err, null, 2));
                setError(err?.message || 'An unknown error occurred');
                setLoading(false);
            }
        };
    
        if (initialized) {
            const token = keycloak.token || '';
            fetchUsers(token);
        }
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

        //const context = conversations[selectedPerson].join('\n');
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

    if (loading) return <div>Loading users...</div>;
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
