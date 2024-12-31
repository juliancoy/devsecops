import React from 'react';
import dummyImage from './assets/dummy-image.jpg'; // Import a dummy image
import './Sidebar.css';

// Define a type for user data
interface User {
    id: string;
    firstName: string;
    lastName: string;
    attributes?: {
        picture?: string[];
    };
}

interface SidebarProps {
    people: User[]; // Update the type of 'people' to match user structure
    selectedPerson: string;
    onPersonSelect: (personId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ people, selectedPerson, onPersonSelect }) => {
    return (
        <aside className="sidebar">
            <ul>
                {people.map(person => {
                    // Get profile picture or fall back to dummy image
                    var profilePicture =
                        person.attributes?.picture?.[0] || dummyImage;

                    // Combine first and last names for display
                    const displayName = `${person.firstName} ${person.lastName}`;

                    return (
                        <li
                            key={person.id}
                            className={selectedPerson === person.id ? 'selected' : ''}
                            onClick={() => onPersonSelect(person.id)}
                        >
                            <img
                                src={profilePicture}
                                alt={displayName}
                                className="person-image"
                            />
                            <span>{displayName}</span>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
};
