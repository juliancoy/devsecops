import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import '../css/ChatPage.css';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';
import * as sdk from 'matrix-js-sdk';
import { ContentSteeringController } from 'hls.js';

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

    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [conversations, setConversations] = useState<{ [key: string]: string[] }>({});
    const [rooms, setRooms] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
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

        // Fetch room names and aliases for each room
        const roomDetails = await Promise.all(
            data.joined_rooms.map(async (roomId: string) => {
                let alias: string | null = null;
                let name: string | null = null;

                // Fetch room aliases
                try {
                    const aliasResponse = await fetch(`${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/aliases`, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    });

                    if (aliasResponse.ok) {
                        const aliasData = await aliasResponse.json();
                        alias = aliasData.aliases?.[0] || null;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch alias for room ${roomId}:`, error);
                }

                // Fetch room name
                try {
                    const nameResponse = await fetch(`${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/state/m.room.name`, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    });

                    if (nameResponse.ok) {
                        const nameData = await nameResponse.json();
                        name = nameData.name || null;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch name for room ${roomId}:`, error);
                }

                return { roomId, alias, name };
            })
        );

        console.log("Room Details:", roomDetails);
        setRooms(roomDetails);
    };


    const fetchPeople = async (token: string, searchTerm: string = "", limit = 10) => {
        const requestBody = {
            limit,
            search_term: searchTerm, // Empty string defaults to searching all users
        };

        const response = await fetch(`${synapseBaseUrl}/_matrix/client/v3/user_directory/search`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch people: ${response.status} ${response.statusText}`);
        }

        console.log("Response received from User Directory API.");
        console.log("People" + response);
        const data = await response.json();
        setPeople(data.results || []); // Assumes the response contains a `results` array of users.
    };


    const handleTokenExpiry = () => {
        localStorage.removeItem('matrixAccessToken');
        navigate('/chatauth');
    };

    useEffect(() => {
        let syncInterval: NodeJS.Timeout;
        const processedEventIds = new Set<string>();

        const fetchRoomMessages = async () => {
            if (!selectedRoom || !accessTokenRef.current) return;

            try {
                const response = await fetch(`${synapseBaseUrl}/_matrix/client/v3/sync`, {
                    headers: {
                        Authorization: `Bearer ${accessTokenRef.current}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to sync messages: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // Extract messages for the selected room
                const roomEvents = data.rooms?.join?.[selectedRoom]?.timeline?.events || [];
                const newMessages = roomEvents
                    .filter(
                        (event: any) =>
                            event.type === "m.room.message" &&
                            event.content?.msgtype === "m.text" &&
                            !processedEventIds.has(event.event_id) // Exclude already processed events
                    )
                    .map((event: any) => {
                        processedEventIds.add(event.event_id); // Mark event as processed
                        return `${event.sender}: ${event.content.body}`;
                    });

                if (newMessages.length > 0) {
                    setConversations((prev) => ({
                        ...prev,
                        [selectedRoom]: [...(prev[selectedRoom] || []), ...newMessages],
                    }));
                }
            } catch (error) {
                console.error("Error fetching room messages:", error);
            }
        };

        // Start polling when a room is selected
        if (selectedRoom) {
            fetchRoomMessages(); // Initial fetch
            syncInterval = setInterval(fetchRoomMessages, 1000); // Poll every 5 seconds
        }

        return () => {
            if (syncInterval) clearInterval(syncInterval); // Clean up polling on unmount or room change
        };
    }, [selectedRoom]);

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
                    await fetchPeople(token);
                    await fetchRooms(token);
                } else if (storedAccessToken) {
                    // Use stored token to fetch rooms
                    accessTokenRef.current = storedAccessToken;
                    await fetchPeople(storedAccessToken);
                    await fetchRooms(storedAccessToken);
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
        if (!prompt.trim() || !selectedRoom) return;

        try {
            // Generate a unique transaction ID (can be a random UUID or timestamp)
            const txnId = `m${Date.now()}`;

            const response = await fetch(`${synapseBaseUrl}/_matrix/client/v3/rooms/${selectedRoom}/send/m.room.message/${txnId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessTokenRef.current}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    msgtype: "m.text",
                    body: prompt,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
            }

            console.log("Message sent successfully!");

            // Add the message locally to the conversations
            setConversations((prev) => ({
                ...prev,
                [selectedRoom]: [...(prev[selectedRoom] || []), `You: ${prompt}`],
            }));
            setPrompt('');
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
        }
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
                    {rooms.map(({ roomId, alias, name }) => (
                        <div
                            key={roomId}
                            className={`room-item ${selectedRoom === roomId ? 'selected' : ''}`}
                            onClick={() => handleRoomSelect(roomId)}
                        >
                            <div className="room-avatar">
                                {name ? name[0].toUpperCase() : alias ? alias[1].toUpperCase() : roomId[0].toUpperCase()}
                            </div>
                            <span>{name || alias || roomId}</span>
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
