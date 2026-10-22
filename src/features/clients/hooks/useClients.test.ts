import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, ClientStatus, ClientType, PaymentStatus, Project } from '../../../types';
import { useClients } from './useClients';

afterEach(() => vi.useRealTimers());

const createClient = (id: string, since: string): Client => ({
    id,
    name: id,
    email: '',
    phone: '',
    since,
    status: ClientStatus.ACTIVE,
    clientType: ClientType.DIRECT,
    lastContact: '',
    portalAccessId: '',
});

const createProject = (id: string, clientId: string, date: string): Project => ({
    id,
    clientId,
    clientName: clientId,
    projectName: id,
    projectType: 'Pernikahan',
    packageName: 'Paket',
    packageId: '',
    addOns: [],
    date,
    location: '',
    progress: 0,
    status: '',
    totalCost: 0,
    amountPaid: 0,
    paymentStatus: PaymentStatus.BELUM_BAYAR,
    team: [],
});

describe('useClients month filter', () => {
    it('defaults to the current month and only shows events in that month and year', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-22T12:00:00'));

        const clients = [
            createClient('october-event', '2026-01-01'),
            createClient('next-year-event', '2026-10-01'),
            createClient('join-month-only', '2026-10-01'),
        ];
        const projects = [
            createProject('october-project', 'october-event', '2026-10-12'),
            createProject('next-year-project', 'next-year-event', '2027-10-12'),
            createProject('november-project', 'join-month-only', '2026-11-12'),
        ];
        const { result } = renderHook(() => useClients(
            clients,
            () => undefined,
            projects,
            () => undefined,
            [],
            () => undefined,
            () => undefined,
            [],
            () => undefined,
            { activeClients: 0, clients: 0 },
        ));

        expect(result.current.monthFilter).toBe('2026-10');
        expect(result.current.filteredClientData.map(client => client.id)).toEqual(['october-event']);
    });
});