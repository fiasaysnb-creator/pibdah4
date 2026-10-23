import React from 'react';
import { Client } from '../../../types';

interface ProjectClientAvatarProps {
    client?: Client;
    name: string;
    className?: string;
}

const getInitials = (name: string) => {
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    return initials.toUpperCase() || '?';
};

const ProjectClientAvatar: React.FC<ProjectClientAvatarProps> = ({ client, name, className = '' }) => (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-accent/20 bg-brand-accent/10 text-[10px] font-bold text-brand-accent ${className}`}>
        {client?.avatarUrl ? (
            <img src={client.avatarUrl} alt={`${name} avatar`} className="h-full w-full object-cover"  loading="lazy" decoding="async" />
        ) : (
            getInitials(name)
        )}
    </span>
);

export default ProjectClientAvatar;
