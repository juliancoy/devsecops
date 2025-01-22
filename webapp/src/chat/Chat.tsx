import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import '../css/Chat.css';
import { fetchMessages, sync, fetchUserProfile } from './Utils'; // Import fetchMessages and sync

import { useNavigate } from 'react-router-dom';

interface ChatProps {
    roomId: string;
}

interface UserProfile {
    displayname: string;
    avatarUrl: string | null;
}

export const Chat: React.FC<ChatProps> = ({ roomId }) => {
    const [conversations, setConversations] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({}); // Store profiles by user ID
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sinceToken, setSinceToken] = useState<string | null>(null); // Token for syncing
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Fetch initial messages and start syncing
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const messages = await fetchMessages(roomId, synapseBaseUrl);
                setConversations(messages);
                setLoading(false);

                // Fetch profiles for all unique senders
                const uniqueSenders = Array.from(new Set(messages.map((msg) => msg.sender)));
                await Promise.all(uniqueSenders.map((sender) => fetchUserProfile(sender, synapseBaseUrl,)));
            } catch (err) {
                setError(`Error fetching messages: ${(err as Error).message}`);
                setLoading(false);
            }
        };

        // Reset state and fetch messages when room changes
        setConversations([]);
        setProfiles({}); // Clear profiles when room changes
        setLoading(true);
        setError(null);
        loadMessages();
        scrollToBottom();
    }, [roomId, synapseBaseUrl]);

    // Start syncing for new messages
    useEffect(() => {
        let isMounted = true;

        const accessToken = localStorage.getItem('matrixAccessToken');
        if (!accessToken) {
            navigate("/chatauth");
        }

        const startSync = async () => {
            try {
                const { messages, nextToken } = await sync(roomId, synapseBaseUrl, sinceToken);

                if (isMounted && messages.length > 0) {
                    // Deduplicate messages using eventId
                    setConversations((prev) => {
                        const existingIds = new Set(prev.map((msg) => msg.eventId));
                        const newMessages = messages.filter((msg) => !existingIds.has(msg.eventId));
                        return [...prev, ...newMessages];
                    });

                    // Fetch profiles for new senders
                    const newSenders = Array.from(new Set(messages.map((msg) => msg.sender)));
                    await Promise.all(newSenders.map((sender) => fetchUserProfile(sender, synapseBaseUrl, accessToken)));

                    scrollToBottom();
                }

                // Update the since token for the next sync
                if (isMounted) {
                    setSinceToken(nextToken);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Sync error:', err);
                    setError(`Sync error: ${(err as Error).message}`);
                }
            }

            // Schedule the next sync
            if (isMounted) {
                setTimeout(startSync, 1000); // Recursive setTimeout instead of setInterval
            }
        };

        startSync();

        // Cleanup on unmount
        return () => {
            isMounted = false;
        };
    }, [roomId, synapseBaseUrl, sinceToken]);

    // Scroll to the bottom when new messages are added
    useEffect(() => {
        scrollToBottom();
    }, [conversations]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;

        const accessToken = localStorage.getItem('matrixAccessToken');
        if (!accessToken) {
            navigate("/chatauth");
        }

        const txnId = `m${Date.now()}`;

        try {
            const puturl = `https://${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/send/m.room.message/${txnId}`;
            console.log(puturl);
            await fetch(puturl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    msgtype: 'm.text',
                    body: prompt,
                }),
            });

            setPrompt('');
            scrollToBottom();
        } catch (err) {
            setError(`Failed to send message: ${(err as Error).message}`);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    if (loading) return <div>Loading messages...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <main className="chat-container">
            <div className="chat-box">
                <div className="responses-container">
                    {conversations.map((message, index) => {
                        const senderProfile = profiles[message.sender];
                        const senderName = senderProfile?.displayname || message.sender;
                        const avatarUrl = senderProfile?.avatarUrl;
                        const timestamp = new Date(message.origin_server_ts).toLocaleTimeString();

                        return (
                            <div key={index} className="chat-message">
                                <div className="message-avatar">
                                    {avatarUrl ? (
                                        <img src={`https://${synapseBaseUrl}/_matrix/media/v3/download/${avatarUrl.replace('mxc://', '')}`} alt="Avatar" />
                                    ) : (
                                        <div className="default-avatar">{senderName[0]}</div>
                                    )}
                                </div>
                                <div className="message-content">
                                    <div className="message-sender">
                                        {senderName} <span className="message-timestamp">{timestamp}</span>
                                    </div>
                                    <div className="message-body">{message.content?.body}</div>
                                </div>
                                <div className="message-options">
                                    <button className="option-button">React</button>
                                    <button className="option-button">Reply in Thread</button>
                                    <button className="option-button">More</button>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} /> {/* Auto-scroll anchor */}
                </div>
                <div className="input-container">
                    <textarea
                        className="chat-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter your message"
                        rows={3}
                    />
                    <button className="send-button" onClick={handleSubmit}>
                        Send
                    </button>
                </div>
            </div>
        </main>
    );
};