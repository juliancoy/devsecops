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
    const [models, setModels] = useState<string[]>([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const synapseBaseUrl = import.meta.env.VITE_SYNAPSE_BASE_URL;

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    // Fetch available models from Ollama
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await fetch('https://ollama.app.codecollective.us/api/tags', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const data = await response.json();
                console.log(data);
                console.log(data.models.map((model: { name: string }) => model.name));
                if (data.models) {
                    const modelNames = data.models.map((model: { name: string }) => model.name);
                    setModels((prevModels) => ['deepseek:janus', ...modelNames]);
                }
            } catch (error) {
                console.error('Failed to fetch Ollama models:', error);
            }
        };
        fetchModels();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async (partial = false) => {
        try {
            const newMessages = await fetchMessages(roomId, synapseBaseUrl, partial);
            if (newMessages.length === 0) return;

            setConversations((prev) => {
                const seenEventIds = new Set(prev.map((message) => message.eventId));
                const uniqueNewMessages = newMessages.filter(
                    (message) => message && message.eventId && !seenEventIds.has(message.eventId)
                );

                return [...prev, ...uniqueNewMessages];
            });

            setLoading(false);
        } catch (err) {
            setError(`Error fetching messages: ${(err as Error).message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        setConversations([]);
        setLoading(true);
        setError(null);
        loadMessages(false);
        scrollToBottom();
    }, [roomId, synapseBaseUrl]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading) loadMessages(true);
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
            setFilteredSuggestions([]);
            setSelectedIndex(-1);
            setTimeout(() => {
                loadMessages(true);
            }, 500);
            scrollToBottom();
        } catch (err) {
            setError(`Failed to send message: ${(err as Error).message}`);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredSuggestions.length > 0) {
                setPrompt(filteredSuggestions[selectedIndex] + ' ');
                setFilteredSuggestions([]);
                setSelectedIndex(-1);
            } else {
                handleSubmit();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredSuggestions.length > 0) {
                setPrompt(filteredSuggestions[selectedIndex] + ' ');
                setFilteredSuggestions([]);
                setSelectedIndex(-1);
            }
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const input = e.target.value;
        setPrompt(input);
    
        if (input.startsWith('/')) {
            const inputWithoutSlash = input.slice(1); // Remove the leading '/'
            const matches = models.filter((model) =>
                model.toLowerCase().startsWith(inputWithoutSlash.toLowerCase())
            );
            setFilteredSuggestions(matches);
            setSelectedIndex(matches.length > 0 ? 0 : -1);
        }
    };
    useEffect(() => {
        console.log('Models state updated:', models);
    }, [models]);

    const formatTimestamp = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
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
                                <img src="/user_3626098.png" alt="Avatar" />
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
                    {filteredSuggestions.length > 0 && (
                        <ul className="autocomplete-list">
                            {filteredSuggestions.map((suggestion, index) => (
                                <li
                                    key={suggestion}
                                    className={index === selectedIndex ? 'selected' : ''}
                                    onMouseDown={() => {
                                        setPrompt(suggestion + ' ');
                                        setFilteredSuggestions([]);
                                    }}
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                    <textarea
                        ref={inputRef}
                        className="chat-input"
                        value={prompt}
                        onChange={handleChange}
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