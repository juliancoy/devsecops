// src/Feed.tsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './Feed.css';

import FeedItem from './FeedItem';

interface BlueskyPost {
    uri: string;
    cid: string;
    value: {
        text: string;
        createdAt: string;
    };
    author: {
        did: string;
        handle: string;
        displayName?: string;
    };
}

interface FeedItemData {
    title: string;
    description: string;
    author: string;
    date: string;
    link: string;
    cid: string;
}

interface Repository {
    did: string;
    handle: string;
}

const Feed: React.FC = () => {
    const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
    const [displayedItems, setDisplayedItems] = useState<FeedItemData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [repoCursor, setRepoCursor] = useState<string | null>(null);
    const [processedDids, setProcessedDids] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    const transformPost = (record: any, repo: Repository): FeedItemData => {
        try {
            return {
                title: record.value.text.slice(0, 50) + (record.value.text.length > 50 ? '...' : ''),
                description: record.value.text,
                author: repo.handle || 'unknown',
                date: new Date(record.value.createdAt).toLocaleString(),
                link: new URL(`/profile/${repo.did}/post/${record.uri.split('/').pop()}`, import.meta.env.VITE_BLUESKY_HOST).toString(),
                cid: record.cid
            };
        } catch (err) {
            return null;
        }
    };

    const fetchPostsForRepo = async (repo: Repository, cursor?: string) => {
        try {
            const url = new URL('/xrpc/com.atproto.repo.listRecords', import.meta.env.VITE_BLUESKY_HOST).toString();
            const response = await axios.get(url, {
                params: {
                    collection: 'app.bsky.feed.post',
                    repo: repo.did,
                    limit: 100,
                    cursor: cursor
                }
            });

            if (response.data?.records) {
                const newPosts = response.data.records
                    .map((record: any) => transformPost(record, repo))
                    .filter(Boolean);

                if (newPosts.length > 0) {
                    setFeedItems(prev => [...prev, ...newPosts]);
                    setDisplayedItems(prev => [...prev, ...newPosts]);
                }

                if (response.data.cursor) {
                    await fetchPostsForRepo(repo, response.data.cursor);
                }
            }
        } catch (error) {
            console.error(`Error fetching posts for ${repo.did}:`, error);
        }
    };

    const fetchRepos = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const url = new URL('/xrpc/com.atproto.sync.listRepos', import.meta.env.VITE_BLUESKY_HOST).toString();
            const response = await axios.get(url, {
                params: {
                    limit: 50,
                    cursor: repoCursor
                }
            });

            if (response.data?.repos) {
                for (const repo of response.data.repos) {
                    if (!processedDids.has(repo.did)) {
                        setProcessedDids(prev => new Set([...prev, repo.did]));
                        await fetchPostsForRepo(repo);
                    }
                }

                if (response.data.cursor) {
                    setRepoCursor(response.data.cursor);
                }
            }
        } catch (error) {
            console.error("Error fetching repositories:", error);
            setError("Failed to fetch repositories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRepos();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (
                containerRef.current &&
                containerRef.current.scrollTop + containerRef.current.clientHeight >= containerRef.current.scrollHeight - 10
            ) {
                fetchRepos();
            }
        };

        const currentContainer = containerRef.current;
        currentContainer?.addEventListener("scroll", handleScroll);

        return () => currentContainer?.removeEventListener("scroll", handleScroll);
    }, [loading, repoCursor]);

    if (error) {
        return <div className="feed-error">{error}</div>;
    }

    return (
        <div className="feed-container-outer" ref={containerRef}>
            <div className="feed-container">
                {displayedItems.map((item, index) => (
                    <FeedItem key={`${item.cid}-${index}`} item={item} />
                ))}
                {loading && <p>Loading more items...</p>}
            </div>
        </div>
    );
};

export default Feed;