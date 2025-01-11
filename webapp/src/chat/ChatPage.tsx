import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import '../css/ChatPage.css';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';

interface ChatProps {
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    handleSubmit: () => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    conversations: string[];
}

export const Chat: React.FC<ChatProps> = ({
    prompt,
    setPrompt,
    handleSubmit,
    handleKeyDown,
    conversations = []
}) => {
    return (
        <main className="chat-container">
            <div className="chat-box">
                <div className="responses-container">
                    {conversations.map((response, index) => (
                        <div key={index} className="chat-message">{response}</div>
                    ))}
                </div>
                <div className="input-container">
                    <textarea
                        className="chat-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter your prompt"
                        rows={3}
                    />
                    <button className="send-button" onClick={handleSubmit}>Send</button>
                </div>
            </div>
        </main>
    );
};

const ChatPage: React.FC = () => {
    const people = [
        { id: '1', firstName: 'Julian', lastName: 'Loiacono', attributes: { picture: ['https://example.com/profile1.jpg'] } },
        { id: '2', firstName: 'Alex', lastName: 'Smith', attributes: { picture: ['https://example.com/profile2.jpg'] } },
        { id: '3', firstName: 'Taylor', lastName: 'Doe', attributes: { picture: ['https://example.com/profile3.jpg'] } },
    ];

    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [conversations, setConversations] = useState<{ [key: string]: string[] }>({});
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const accessTokenRef = useRef<string | null>(null);
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const fetchRooms = async (token: string) => {
        const response = await fetch(`${synapseBaseUrl}/_matrix/client/r0/joined_rooms`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch rooms');
        const data = await response.json();
        setRooms(data.joined_rooms || []);
    };

    useEffect(() => {
        const initialize = async () => {
            try {
                const storedAccessToken = localStorage.getItem('matrixAccessToken');
                if (storedAccessToken) {
                    accessTokenRef.current = storedAccessToken;
                    await fetchRooms(storedAccessToken);
                } else {
                    navigate('/chatauth');
                }
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError('Failed to initialize');
                setLoading(false);
            }
        };
        initialize();
    }, [navigate]);

    const handleSubmit = () => {
        if (!prompt.trim() || !selectedRoom) return;
        setConversations((prev) => ({
            ...prev,
            [selectedRoom]: [...(prev[selectedRoom] || []), `You: ${prompt}`],
        }));
        setPrompt('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleRoomSelect = (roomId: string) => {
        setSelectedRoom(roomId);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="chat-page">
            <div className="sidebar">
                <div className="rooms-list">
                    {rooms.map((room) => (
                        <div
                            key={room}
                            className={`room-item ${selectedRoom === room ? 'selected' : ''}`}
                            onClick={() => handleRoomSelect(room)}
                        >
                            <div className="room-avatar">{room[0].toUpperCase()}</div>
                            <span>{room}</span>
                        </div>
                    ))}
                </div>
                <div className="add-room" onClick={() => alert('Add Room')}>
                    +
                </div>
                <div className="people-list">
                    <h4>People</h4>
                    {people.map((person) => (
                        <div key={person.id} className="person-item">
                            <img src={person.attributes.picture[0]} alt={person.firstName} />
                            <span>{person.firstName} {person.lastName}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="chat-area">
                {selectedRoom ? (
                    <Chat
                        prompt={prompt}
                        setPrompt={setPrompt}
                        handleSubmit={handleSubmit}
                        handleKeyDown={handleKeyDown}
                        conversations={conversations[selectedRoom] || []}
                    />
                ) : (
                    <div className="select-room">Select a room to start chatting</div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
