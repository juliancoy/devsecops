import React, { useState, useEffect } from 'react';
import '../css/ExploreRooms.css';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';

const ExploreRooms: React.FC = () => {
    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [publicRooms, setPublicRooms] = useState<any[]>([]);

    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const fetchPublicRooms = async (token: string) => {
        const response = await fetch(`${synapseBaseUrl}/_matrix/client/r0/publicRooms`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) throw new Error('Failed to fetch public rooms');
        const data = await response.json();
        console.log(data.chunk);
        setPublicRooms(data.chunk || []);
    };

    useEffect(() => {
        const initialize = async () => {
            const storedAccessToken = localStorage.getItem('matrixAccessToken');

            if (!storedAccessToken) {
                navigate('/chatauth');
                return;
            }

            try {
                await fetchPublicRooms(storedAccessToken);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching public rooms:', err);
                setError(err instanceof Error ? err.message : 'Unknown error occurred');
                setLoading(false);
            }
        };

        initialize();
    }, [navigate, synapseBaseUrl]);

    const handleCreateRoomClick = () => {
        navigate('/create-room'); // Navigate to the room creation page
    };

    if (loading) return <div>Loading public rooms...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div id="public-rooms-container">
            <h1>Public Rooms</h1>
            <div className="create-room-box" onClick={handleCreateRoomClick}>
                <div className="plus-sign">+</div>
                <p>Create Room</p>
            </div>
            <ul>
                {publicRooms.map((room) => (
                    <li key={room.room_id}>
                        <div>
                            <h2>{room.name || 'Unnamed Room'}</h2>
                            <p>{room.topic || 'No topic provided'}</p>
                            <small>Members: {room.num_joined_members}</small>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ExploreRooms;
