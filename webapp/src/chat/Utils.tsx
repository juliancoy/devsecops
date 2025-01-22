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

export const sync = async (
    roomId: string,
    synapseBaseUrl: string,
    sinceToken?: string,
    timeout: number = 30000
): Promise<{ messages: any[]; nextToken: string | null }> => {
    const accessToken = localStorage.getItem('matrixAccessToken');
    if (!accessToken) {
        throw new Error('Access token not found.');
    }

    // Build the filter object
    const filter = {
        room: {
            timeline: {
                limit: 50, // Limit the number of events returned
                types: ['m.room.message'], // Only fetch message events
            },
            include_leave: false, // Exclude rooms the user has left
        },
    };

    // Build the sync URL
    const syncUrl = new URL(`https://${synapseBaseUrl}/_matrix/client/v3/sync`);
    syncUrl.searchParams.set('timeout', timeout.toString());
    if (sinceToken) {
        syncUrl.searchParams.set('since', sinceToken); // Use the since token to fetch only new messages
    }
    syncUrl.searchParams.set('filter', JSON.stringify(filter)); // Encode filter only once

    const response = await fetch(syncUrl.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to sync: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract the next sync token
    const nextToken = data.next_batch || null;

    // Extract messages for the specified room
    const roomData = data.rooms?.join?.[roomId];
    if (!roomData || !roomData.timeline?.events) {
        console.log('No new timeline events found for this room.');
        return { messages: [], nextToken };
    }

    // Filter and map message events
    const messages = roomData.timeline.events
        .filter((event: any) => event.type === 'm.room.message' && event.content);

    console.log(messages);

    // Sort messages by timestamp
    messages.sort((a: any, b: any) => (a.origin_server_ts || 0) - (b.origin_server_ts || 0));

    return { messages, nextToken };
};

export const fetchMessages = async (roomId: string, synapseBaseUrl: string) => {
    const accessToken = localStorage.getItem('matrixAccessToken');
    if (!accessToken) {
        throw new Error('Access token not found.');
    }

    // Build the filter object
    const filter = {
        room: {
            timeline: {
                limit: 50, // Limit the number of events returned
            },
        },
    };

    // Build the sync URL
    const syncUrl = new URL(`https://${synapseBaseUrl}/_matrix/client/v3/sync`);
    syncUrl.searchParams.set('filter', JSON.stringify(filter));

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
    const roomData = data.rooms?.join?.[roomId];

    if (!roomData || !roomData.timeline?.events) {
        console.log('No timeline events found for this room.');
        return [];
    }
    console.log(roomData);

    // Filter and map message events
    const messages = roomData.timeline.events
        .filter((event: any) => event.type === 'm.room.message');

    // Sort messages by timestamp
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

export const fetchUserProfile = async (userId: string, synapseBaseUrl: string, accessToken: string) => {
    const profileUrl = `https://${synapseBaseUrl}/_matrix/client/v3/profile/${userId}`;
    const response = await fetch(profileUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error(`Failed to fetch profile for user ${userId}: ${response.status} ${response.statusText}`);
        return null;
    }
    console.log("User");
    console.log(await response.json());

    return await response.json();
};