// src/FeedItem.tsx
import React from 'react';
import './FeedItem.css';

const FeedItem: React.FC<{ item: any }> = ({ item }) => {
    const { author, avatar, display_name, handle } = item.post.author;
    const { text, created_at } = item.post.record;
    const image = item.post.embed?.images?.[0]?.fullsize;
    const likeCount = item.post.like_count || 0;
    const replyCount = item.post.reply_count || 0;
    const repostCount = item.post.repost_count || 0;

    return (
        <div className="feed-item">
            <div className="feed-item-header">
                <img className="avatar" src={avatar} alt={`${display_name}'s avatar`} />
                <div className="author-info">
                    <span className="display-name">{display_name}</span>
                    <span className="author-handle">@{handle}</span>
                    <span className="separator">•</span>
                    <span>{new Date(created_at).toLocaleString()}</span>
                </div>
            </div>
            <div className="feed-item-content">
                <p>{text}</p>
                {image && <img className="content-image" src={image} alt="Post content" />}
            </div>
            <div className="feed-item-actions">
                <div className="action">
                    <span>👍</span>
                    <span>{likeCount}</span>
                </div>
                <div className="action">
                    <span>💬</span>
                    <span>{replyCount}</span>
                </div>
                <div className="action">
                    <span>🔄</span>
                    <span>{repostCount}</span>
                </div>
            </div>
        </div>
    );
};

export default FeedItem;
