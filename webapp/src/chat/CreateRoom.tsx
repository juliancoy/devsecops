import React, { useState } from 'react';
import '../css/CreateRoom.css';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';

const CreateRoom: React.FC = () => {
    const { keycloak, initialized } = useKeycloak();
    const navigate = useNavigate();
    const [roomName, setRoomName] = useState('');
    const [roomTopic, setRoomTopic] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomName.trim()) {
            setError('Room name is required');
            return;
        }

        const storedAccessToken = localStorage.getItem('matrixAccessToken');
        if (!storedAccessToken) {
            navigate('/chatauth');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${synapseBaseUrl}/_matrix/client/r0/createRoom`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${storedAccessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: roomName,
                    topic: roomTopic,
                    preset: 'public_chat', // Set room visibility to public
                }),
            });

            if (!response.ok) throw new Error('Failed to create room');
            const data = await response.json();
            navigate(`/room/${data.room_id}`); // Redirect to the new room
        } catch (err) {
            console.error('Error creating room:', err);
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-room-container">
            <h1>Create a Room</h1>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit} className="create-room-form">
                <div className="form-group">
                    <label htmlFor="roomName">Room Name</label>
                    <input
                        type="text"
                        id="roomName"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Enter room name"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="roomTopic">Room Topic</label>
                    <textarea
                        id="roomTopic"
                        value={roomTopic}
                        onChange={(e) => setRoomTopic(e.target.value)}
                        placeholder="Enter room topic (optional)"
                    ></textarea>
                </div>
                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Room'}
                </button>
            </form>
        </div>
    );
};

export default CreateRoom;
