// Utils.tsx

import { json } from "stream/consumers";

export const fetchRooms = async (token: string, synapseBaseUrl: string) => {
    // Fetch the list of joined rooms
    const response = await fetch(`https://${synapseBaseUrl}/_matrix/client/r0/joined_rooms`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Failed to fetch rooms');
    const data = await response.json();
    console.log(JSON.stringify(data));

    // Fetch room details (name, alias, and avatar) for each room
    const roomDetails = await Promise.all(
        data.joined_rooms.map(async (roomId: string) => {
            let alias: string | null = null;
            let name: string | null = null;
            let avatarUrl: string | null = null;

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
                const nameResponse = await fetch(`https://${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/state/m.room.name`, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });

                if (nameResponse.ok) {
                    const nameData = await nameResponse.json();
                    name = nameData.name || null;
                }
            } catch (error) {
                console.warn(`Failed to fetch name for room ${roomId}:`, error);
            }

            // Fetch room avatar
            try {
                const avatarResponse = await fetch(`https://${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/state/m.room.avatar`, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });

                if (avatarResponse.ok) {
                    const avatarData = await avatarResponse.json();
                    avatarUrl = avatarData.url || null;
                }
            } catch (error) {
                console.warn(`Failed to fetch avatar for room ${roomId}:`, error);
            }

            return { roomId, alias, name, avatarUrl };
        })
    );
    
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

var since = null;
export const fetchMessages = async (roomId: string, synapseBaseUrl: string) => {
    const accessToken = localStorage.getItem('matrixAccessToken');
    if (!accessToken) {
        throw new Error('Access token not found.');
    }

    // Retrieve 'since' token from local storage if available
    const syncUrl = new URL(`https://${synapseBaseUrl}/_matrix/client/v3/sync`);
    
    // Add 'since' parameter if available for incremental sync
    if (since) {
        syncUrl.searchParams.append('since', since);
    }
    //syncUrl.searchParams.append('timeout', '30000'); // Long polling timeout
    //syncUrl.searchParams.append('filter', encodeURIComponent(JSON.stringify({ room: { timeline: { limit: 50 } } })));

    const response = await fetch(syncUrl.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Save the next_batch token for the next sync request
    if (data.next_batch) {
        since = data.next_batch;
    }
    
    const roomData = data.rooms?.join?.[roomId];
    if (!roomData || !roomData.timeline?.events) {
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

    messages.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
    return messages;
};

export const fetchPublicRooms = async (
    token: string,
    synapseBaseUrl: string,
    federated: boolean = false
) => {
    try {
        // Set up query parameters
        const params = new URLSearchParams();

        // Add the `server` parameter only for local search
        if (!federated) {
            params.append('server', synapseBaseUrl);
        }

        // Add the `include_all_networks` parameter for federated search
        params.append('include_all_networks', federated ? 'true' : 'false');

        // Construct the request URL
        const requestUrl = `https://${synapseBaseUrl}/_matrix/client/v3/publicRooms?${params.toString()}`;
        console.log('Request URL:', requestUrl);

        // Fetch public rooms
        const response = await fetch(requestUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // Handle errors
        if (!response.ok) {
            const responseText = await response.text(); // Log the raw response
            console.error('Error response:', responseText);
            throw new Error(`Failed to fetch public rooms: ${response.status} ${response.statusText}`);
        }

        // Parse and return the room data
        const data = await response.json();
        return data.chunk || [];
    } catch (err) {
        console.error('Error fetching public rooms:', err);
        throw err;
    }
};

export const joinRoom = async (accessToken: string, synapseBaseUrl: string, roomId: string) => {
    const response = await fetch(`https://${synapseBaseUrl}/_matrix/client/r0/join/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        throw new Error(`Failed to join room: ${response.statusText}`);
    }

    return response.json();
};