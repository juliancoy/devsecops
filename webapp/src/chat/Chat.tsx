import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import '../css/Chat.css';
import { fetchMessages, Message } from './Utils';

interface ChatProps {
    roomId: string;
}

export const Chat: React.FC<ChatProps> = ({ roomId }) => {
    const [conversations, setConversations] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async (partial = false) => {
        try {
            const newMessages = await fetchMessages(roomId, synapseBaseUrl, partial);

            if (newMessages.length === 0) {
                console.log('No new messages found.');
                return;
            }

            setConversations((prevConversations) => {
                const seenEventIds = new Set(prevConversations.map((message) => message.eventId));
                const uniqueNewMessages = newMessages.filter(
                    (message) => message && message.eventId && !seenEventIds.has(message.eventId)
                );

                return [...prevConversations, ...uniqueNewMessages];
            });

            setLoading(false);
        } catch (err) {
            setError(`Error fetching messages: ${(err as Error).message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log("Room changed. Loading messages");
        setConversations([]);
        setLoading(true);
        setError(null);
        loadMessages(false); // Full sync when the room changes
        scrollToBottom();
    }, [roomId, synapseBaseUrl]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading) {
                loadMessages(true); // Always perform a partial sync in the interval
                console.log("Loaded messages");
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [roomId, synapseBaseUrl, loading]);

    useEffect(() => {
        scrollToBottom();
    }, [conversations]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;

        const accessToken = localStorage.getItem('matrixAccessToken');
        if (!accessToken) {
            setError('Access token not found.');
            return;
        }

        const txnId = `m${Date.now()}`;

        try {
            await fetch(
                `https://${synapseBaseUrl}/_matrix/client/v3/rooms/${roomId}/send/m.room.message/${txnId}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        msgtype: 'm.text',
                        body: prompt,
                    }),
                }
            );

            setPrompt('');
            setTimeout(() => {
                loadMessages(true); // Perform a partial sync after a short delay
            }, 500); // Wait 500ms for the server to process the message
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

    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    if (loading) return <div>Loading messages...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <main className="chat-container">
            <div className="chat-box">
                <div className="responses-container">
                    {conversations.map((message) => (
                        <div key={message.eventId} className="chat-message">
                            <div className="message-avatar">
                                {message.avatarUrl ? (
                                    <img src="/user_3626098.png" alt="Avatar" />
                                ) : (
                                    <img src="/user_3626098.png" alt="Avatar" />
                                )}
                            </div>
                            <div className="message-content">
                                <div className="message-sender">
                                    {message.displayName || message.sender}
                                    <span className="message-timestamp">
                                        {message.timestamp ? formatTimestamp(message.timestamp) : ''}
                                    </span>
                                </div>
                                <div className="message-body">{message.body}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
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