// src/Feed.tsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import './Feed.css';

import FeedItem from './FeedItem';

interface FeedItemData {
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
}

const Feed: React.FC = () => {
    const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
    const [displayedItems, setDisplayedItems] = useState<FeedItemData[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchFeedItems = async () => {
            try {
                const [eventsRes, threadsRes] = await Promise.all([
                    axios.get('/ipsum/events.json'),
                    axios.get('/ipsum/threads.json')
                ]);

                const eventsData: FeedItemData[] = eventsRes.data.map((item: FeedItemData) => ({
                    ...item,
                    type: 'event'
                }));

                const threadsData: FeedItemData[] = threadsRes.data.map((item: FeedItemData) => ({
                    ...item,
                    type: 'thread'
                }));

                const combinedData = alternateItems(eventsData, threadsData);
                setFeedItems(shuffleArray(combinedData));
                setDisplayedItems(combinedData.slice(0, 10));
            } catch (error) {
                console.error("Error fetching feed data:", error);
            }
        };

        fetchFeedItems();
    }, []);

    const alternateItems = (arr1: FeedItemData[], arr2: FeedItemData[]): FeedItemData[] => {
        const result: FeedItemData[] = [];
        const maxLength = Math.max(arr1.length, arr2.length);

        for (let i = 0; i < maxLength; i++) {
            if (i < arr1.length) result.push(arr1[i]);
            if (i < arr2.length) result.push(arr2[i]);
        }
        return result;
    };

    const shuffleArray = (array: FeedItemData[]): FeedItemData[] => {
        return array
            .map(item => ({ ...item, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ sort, ...item }) => item);
    };

    const loadMoreItems = () => {
        if (loading || displayedItems.length >= feedItems.length) return;
        setLoading(true);
        setTimeout(() => {
            setDisplayedItems(prevItems => [
                ...prevItems,
                ...feedItems.slice(prevItems.length, prevItems.length + 10)
            ]);
            setLoading(false);
        }, 1000);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (
                containerRef.current &&
                containerRef.current.scrollTop + containerRef.current.clientHeight >= containerRef.current.scrollHeight - 10
            ) {
                loadMoreItems();
            }
        };

        const currentContainer = containerRef.current;
        currentContainer?.addEventListener("scroll", handleScroll);

        return () => currentContainer?.removeEventListener("scroll", handleScroll);
    }, [feedItems, loading]);

    return (
        <div className="feed-container-outer" ref={containerRef}>
            <div className="feed-container">
                {displayedItems.map((item, index) => (
                    <FeedItem key={index} item={item} />
                ))}
                {loading && <p>Loading more items...</p>}
            </div>
        </div>
    );
};

export default Feed;
