// src/FeedItem.tsx
import React from 'react';
import './FeedItem.css';

interface FeedItemProps {
    item: {
        title: string;
        description: string;
        category: string;
        date: string;
        author: string;
        link: string;
        type: string;
        likes?: number;
        replies?: number;
        comments?: number;
    };
}

const LikeIcon = () => (
    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
);

const CommentIcon = () => (
    <svg viewBox="0 0 24 24"><path d="M9 22c-1.11 0-2-.89-2-2H5a3 3 0 0 1-3-3V5c0-1.11.89-2 2-2h14c1.11 0 2 .89 2 2v12c0 1.11-.89 2-2 2h-6l-4 3zm6.83-5h-1.58L9 20v-3H5V5h14v10z"/></svg>
);

const ShareIcon = () => (
    <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.04-.23.09-.46.09-.7s-.05-.47-.09-.7l7.05-4.11c.53.48 1.21.79 1.96.79a2.5 2.5 0 0 0 0-5c-1.3 0-2.37 1-2.47 2.25L8.53 8.91c-.47-.36-1.06-.58-1.69-.58a2.5 2.5 0 0 0 0 5c.63 0 1.22-.22 1.69-.58l7.05 4.11c.1 1.25 1.17 2.25 2.47 2.25a2.5 2.5 0 0 0 0-5z"/></svg>
);

const FeedItem: React.FC<FeedItemProps> = ({ item }) => {
    return (
        <div className={`feed-item ${item.type === 'event' ? 'category-E' : 'category-A'}`}>
            <div className="feed-item-header">
                <img src="/path/to/icon.png" alt="Icon" />
                <span className="author">{item.author}</span>
                <span className="separator">•</span>
                <span>{item.date}</span>
            </div>
            <div className="feed-item-title">{item.title}</div>
            <div className="feed-item-description">{item.description}</div>
            <div className="feed-item-actions">
                <div className="action">
                    <LikeIcon />
                    <span>{item.likes ?? 0}</span>
                </div>
                <div className="action">
                    <CommentIcon />
                    <span>{item.comments ?? 0}</span>
                </div>
                <div className="action">
                    <ShareIcon />
                    <span>Share</span>
                </div>
            </div>
        </div>
    );
};

export default FeedItem;
