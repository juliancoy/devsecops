import React from 'react';
import './Chat.css';

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
