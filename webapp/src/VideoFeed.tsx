// src/Feed.tsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './VideoFeed.css';
import Hls from 'hls.js';

const VideoFeedItem: React.FC<{ post: any }> = ({ post }) => {
    const { avatar, display_name, handle } = post.author;
    const { text, created_at } = post.record;
    const playlistUrl = post.embed?.playlist; // Use playlist URL if available
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;

        if (video && playlistUrl) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(playlistUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch((error) => {
                        console.error("Autoplay failed:", error);
                    });
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = playlistUrl;
                video.play().catch((error) => {
                    console.error("Autoplay failed:", error);
                });
            }
        }
    }, [playlistUrl]);

    return (
        <div className="video-feed-item">
            {/* Video Player */}
            <div className="video-container">
                <video
                    ref={videoRef}
                    controls
                    muted
                    playsInline
                    className="video-player"
                />
            </div>

            {/* Author Info */}
            <div className="author-info">
                <img className="avatar" src={avatar} alt={`${display_name}'s avatar`} />
                <div className="author-details">
                    <span className="display-name">{display_name}</span>
                    <span className="author-handle">@{handle}</span>
                </div>
            </div>

            {/* Post Content */}
            <div className="post-content">
                <p className="content-text">{text}</p>
                <span className="timestamp">{new Date(created_at).toLocaleString()}</span>
            </div>

            {/* Actions (Like, Comment, Repost) */}
            <div className="video-actions">
                <div className="action">
                    <span role="img" aria-label="Like">👍</span>
                    <span>{post.like_count || 0}</span>
                </div>
                <div className="action">
                    <span role="img" aria-label="Comment">💬</span>
                    <span>{post.reply_count || 0}</span>
                </div>
                <div className="action">
                    <span role="img" aria-label="Repost">🔄</span>
                    <span>{post.repost_count || 0}</span>
                </div>
            </div>
        </div>
    );
};

const Feed: React.FC = () => {
    const [feedItems, setFeedItems] = useState<any[]>([]); // Store raw JSON objects directly
    const [displayedItems, setDisplayedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchFeedItems = async () => {
            try {
                const response = await axios.get('https://bsky_bridge.app.codecollective.us/video');
                console.log("Fetched feed data:", response.data);
                setFeedItems(response.data.feed);
                setDisplayedItems(response.data.feed.slice(0, 5));
            } catch (error) {
                console.error("Error fetching feed data:", error);
            }
        };

        fetchFeedItems();
    }, []);

    const loadMoreItems = () => {
        if (loading || displayedItems.length >= feedItems.length) return;
        setLoading(true);
        setTimeout(() => {
            setDisplayedItems((prevItems) => [
                ...prevItems,
                ...feedItems.slice(prevItems.length, prevItems.length + 1),
            ]);
            setLoading(false);
        }, 1000);
    };

    useEffect(() => {
        const handleScroll = () => {
            const container = containerRef.current;
            if (!container) return;

            // Load more items when reaching the bottom
            if (
                container.scrollTop + container.clientHeight >=
                container.scrollHeight - 10
            ) {
                loadMoreItems();
            }

            // Handle video playback based on scroll position
            const videos = container.querySelectorAll<HTMLVideoElement>('video');
            videos.forEach((video) => {
                const rect = video.getBoundingClientRect();
                if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        };

        containerRef.current?.addEventListener('scroll', handleScroll);
        return () => containerRef.current?.removeEventListener('scroll', handleScroll);
    }, [feedItems, displayedItems]);

    return (
        <div className="feed-container-outer" ref={containerRef}>
            <div className="feed-container">
                {displayedItems.map((item, index) => (
                    <VideoFeedItem key={index} post={item.post} />
                ))}
                {loading && <p>Loading more items...</p>}
            </div>
        </div>
    );
};

export default Feed;
