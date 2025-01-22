// ChatPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import '../css/ChatPage.css';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';
import { Chat } from './Chat';
import { fetchRooms, fetchPeople, joinRoom } from './Utils'; // Import joinRoom function

const ChatPage: React.FC = () => {
    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [selectedRoom, setSelectedRoom] = useState<string | null>(
        localStorage.getItem('selectedRoom') // Load the selected room from localStorage
    );
    const [conversations, setConversations] = useState<{ [key: string]: string[] }>({});
    const [rooms, setRooms] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const accessTokenRef = useRef<string | null>(null);
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    // Define pinned rooms
    const pinnedRooms = [
        { roomId: '!OfJNzyMEhVoxCBBcSV:matrix.org', alias: 'Room 1' },
        { roomId: '!NRTafywrMGISLMcipa:matrix.org', alias: 'Room 2' }
    ];

    const handleTokenExpiry = () => {
        localStorage.removeItem('matrixAccessToken');
        navigate('/chatauth');
    };

    const handleRoomSelect = async (roomId: string) => {
        const storedAccessToken = localStorage.getItem('matrixAccessToken');
        if (storedAccessToken) {
            try {
                // Join the room if not already a member
                await joinRoom(storedAccessToken, synapseBaseUrl, roomId);
                setSelectedRoom(roomId);
                localStorage.setItem('selectedRoom', roomId); // Save the selected room to localStorage
            } catch (error) {
                setError((error as Error).message);
            }
        }
    };

    useEffect(() => {
        const initialize = async () => {
            const storedAccessToken = localStorage.getItem('matrixAccessToken');
            if (storedAccessToken) {
                accessTokenRef.current = storedAccessToken;
                try {
                    const peopleData = await fetchPeople(storedAccessToken, synapseBaseUrl);
                    setPeople(peopleData);

                    const roomsData = await fetchRooms(storedAccessToken, synapseBaseUrl);
                    setRooms(roomsData);
                } catch (error) {
                    setError((error as Error).message);
                }
            } else {
                navigate('/chatauth');
            }
            setLoading(false);
        };

        initialize();
    }, [navigate, synapseBaseUrl]);

    useEffect(() => {
        if (!selectedRoom) {
            const storedRoom = localStorage.getItem('selectedRoom');
            if (storedRoom) {
                setSelectedRoom(storedRoom);
            }
        }
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="chat-page">
            <div className="sidebar">
                <div className="pinned-rooms">
                    <h4>Pinned Rooms</h4>
                    {pinnedRooms.map(({ roomId, alias }) => (
                        <div
                            key={roomId}
                            className={`room-item ${selectedRoom === roomId ? 'selected' : ''}`}
                            onClick={() => handleRoomSelect(roomId)}
                        >
                            <div className="room-avatar">
                                {alias ? alias[0].toUpperCase() : roomId[0].toUpperCase()}
                            </div>
                            <span>{alias || roomId}</span>
                        </div>
                    ))}
                </div>

                <div className="rooms-list">
                    <h4>Rooms</h4>
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

                <div
                    className="add-room"
                    onClick={() => navigate('/create-room')}
                >
                    Create Room
                </div>


                <div
                    className="add-room"
                    onClick={() => navigate('/explore')}
                >
                    Explore Public Rooms
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
                    <Chat roomId={selectedRoom} />
                ) : (
                    <div className="select-room">Select a room to start chatting</div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;