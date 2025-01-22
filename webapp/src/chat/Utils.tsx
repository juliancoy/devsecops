// Utils.tsx

export const fetchRooms = async (token: string, synapseBaseUrl: string) => {
    const response = await fetch(`https://${synapseBaseUrl}/_matrix/client/r0/joined_rooms`, {
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
                const aliasResponse = await fetch(`https://${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/aliases`, {
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

    // Add the "+" synthetic room
    roomDetails.push({
        roomId: "create-room",
        alias: null,
        name: "+Create Room",
    });

    console.log("Room Details:", roomDetails);
    return roomDetails;
};


export const fetchPeople = async (token: string, synapseBaseUrl: string, searchTerm: string = "", limit = 10) => {
    const requestBody = {
        limit,
        search_term: searchTerm, // Empty string defaults to searching all users
    };

    const response = await fetch(`https://${synapseBaseUrl}/_matrix/client/v3/user_directory/search`, {
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

    const data = await response.json();
    console.log(`Response received from User Directory API. ${JSON.stringify(data)}`);
    return data.results || []; // Assumes the response contains a `results` array of users.
};

// Utils.tsx

export interface Message {
    sender: string;
    body: string;
    avatarUrl?: string;
    timestamp?: number;
    eventId?: string; // Include event ID for deduplication
}

export const fetchMessages = async (roomId: string, synapseBaseUrl: string) => {
    const accessToken = localStorage.getItem('matrixAccessToken');
    if (!accessToken) {
        throw new Error('Access token not found.');
    }

    const response = await fetch(
        `https://${synapseBaseUrl}/_matrix/client/v3/sync?filter=${encodeURIComponent(
            JSON.stringify({ room: { timeline: { limit: 50 } } })
        )}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const roomData = data.rooms?.join?.[roomId];

    if (!roomData || !roomData.timeline?.events) {
        console.log('No timeline events found for this room.');
        return [];
    }

    const messages = roomData.timeline.events
        .filter((event: any) => event.type === 'm.room.message')
        .map((event: any) => ({
            sender: event.sender,
            body: event.content?.body || '[Unknown Message]',
            avatarUrl: event.content?.avatar_url || null,
            timestamp: event.origin_server_ts || 0,
            eventId: event.event_id, // Include event ID for deduplication
        }));

    messages.sort((a: Message, b: Message) => (a.timestamp || 0) - (b.timestamp || 0));

    return messages;
};

export const fetchFederatedPublicRooms = async (token: string, synapseBaseUrl: string) => {
    try {
        const params = new URLSearchParams({
            'include_all_networks': 'true'  // This includes federated rooms
        });
        
        const response = await fetch(
            `https://${synapseBaseUrl}/_matrix/client/v3/publicRooms?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) throw new Error('Failed to fetch federated public rooms');
        const data = await response.json();
        return data.chunk || [];
    } catch (err) {
        console.error('Error fetching federated public rooms:', err);
        throw err;
    }
};

export const fetchLocalPublicRooms = async (token: string, synapseBaseUrl: string) => {
    try {

        const params = new URLSearchParams({
            'server': synapseBaseUrl,
        });

        const requestUrl = `https://${synapseBaseUrl}/_matrix/client/v3/publicRooms?${params.toString()}`;
        console.log('Request URL:', requestUrl);

        const response = await fetch(requestUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const responseText = await response.text(); // Log the raw response
            console.error('Error response:', responseText);
            throw new Error(`Failed to fetch local public rooms: ${response.status} ${response.statusText}`);
        }

        const data = await response.json(); // Parse JSON
        return data.chunk || [];
    } catch (err) {
        console.error('Error fetching local public rooms:', err);
        throw err;
    }
};
