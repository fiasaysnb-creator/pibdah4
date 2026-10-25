import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataPengantinHub } from './DataPengantinHub';
import { Client, ClientStatus, ClientType, NavigationAction, Profile, ViewType } from '../../types';

vi.mock('../clients/ClientsPage', async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  return {
    default: (props: {
      clients: Client[];
      handleNavigation: (view: ViewType, action?: NavigationAction) => void;
    }): React.ReactElement => (
      <button
        type="button"
        onClick={() => props.handleNavigation(ViewType.CLIENTS, { type: 'view', id: props.clients[0].id })}
      >
        Client management loaded
      </button>
    ),
  };
});

describe('DataPengantinHub', () => {
  it('loads client management and forwards navigation without opening a separate projects page', async () => {
    const client: Client = {
      id: 'client-1',
      name: 'Test Client',
      email: '',
      phone: '',
      since: '',
      status: ClientStatus.ACTIVE,
      clientType: ClientType.DIRECT,
      lastContact: '',
      portalAccessId: 'portal-1',
    };
    const handleNavigation = vi.fn();

    render(
      <DataPengantinHub
        activeView={ViewType.CLIENTS}
        handleNavigation={handleNavigation}
        clients={[client]}
        setClients={() => undefined}
        projects={[]}
        setProjects={() => undefined}
        teamProjectPayments={[]}
        setTeamProjectPayments={() => undefined}
        leads={[]}
        teamMembers={[]}
        transactions={[]}
        setTransactions={() => undefined}
        packages={[]}
        setPackages={() => undefined}
        addOns={[]}
        setAddOns={() => undefined}
        clientFeedback={[]}
        setClientFeedback={() => undefined}
        profile={{} as Profile}
        showNotification={() => undefined}
        addNotification={async () => undefined}
        cards={[]}
        setCards={() => undefined}
        pockets={[]}
        setPockets={() => undefined}
        promoCodes={[]}
        setPromoCodes={() => undefined}
        appData={null}
        initialAction={null}
        setInitialAction={() => undefined}
        onSignInvoice={() => undefined}
        onSignTransaction={() => undefined}
        onRecordPayment={async () => undefined}
      />,
    );

    expect(screen.getByText('Memuat data...')).toBeTruthy();
    fireEvent.click(await screen.findByText('Client management loaded'));

    expect(handleNavigation).toHaveBeenCalledWith(ViewType.CLIENTS, { type: 'view', id: client.id });
    expect(screen.queryByText('Projects tab loaded')).toBeNull();
  });
});
