import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const selectMock = vi.fn();
const upsertMock = vi.fn();
const deleteMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();
let queryResults: Array<{ data: unknown; error: null }> = [];

const queryBuilder = {
  select: selectMock,
  upsert: upsertMock,
  delete: deleteMock,
  eq: eqMock,
  in: inMock,
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    const result: { data: unknown; error: null } = queryResults.shift() || { data: [] as unknown[], error: null };
    return Promise.resolve(result).then(resolve, reject);
  },
};

vi.mock('../../lib/supabaseClient', () => ({
  default: { from: fromMock },
}));

describe('team project payment integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    fromMock.mockReturnValue(queryBuilder);
    selectMock.mockReturnValue(queryBuilder);
    upsertMock.mockReturnValue(queryBuilder);
    deleteMock.mockReturnValue(queryBuilder);
    eqMock.mockReturnValue(queryBuilder);
    inMock.mockReturnValue(queryBuilder);
  });

  it('rejects a blank fee date before sending a database request', async () => {
    const { updateTeamProjectPayments } = await import('../teamProjectPayments');

    await expect(updateTeamProjectPayments([{
      id: '4d44d2ac-97bb-4cb3-9f61-26a3608719e1',
      projectId: 'project-1',
      teamMemberName: 'Ayu',
      teamMemberId: 'member-1',
      date: '',
      status: 'Unpaid' as const,
      fee: 500000,
    }])).rejects.toThrow('Tanggal acara wajib valid');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('keeps a paid fee row when an assignment is replaced', async () => {
    const paidRow = {
      id: '4d44d2ac-97bb-4cb3-9f61-26a3608719e1',
      project_id: 'project-1',
      team_member_name: 'Ayu',
      team_member_id: 'member-old',
      date: '2026-10-13',
      status: 'Paid',
      fee: 500000,
    };
    const newRow = {
      id: '833adf4e-611e-45a2-80bb-86f08edc5911',
      projectId: 'project-1',
      teamMemberName: 'Bima',
      teamMemberId: 'member-new',
      date: '2026-10-13',
      status: 'Unpaid',
      fee: 750000,
    };
    const persistedNewRow = {
      id: newRow.id,
      project_id: newRow.projectId,
      team_member_name: newRow.teamMemberName,
      team_member_id: newRow.teamMemberId,
      date: newRow.date,
      status: newRow.status,
      fee: newRow.fee,
    };
    queryResults = [
      { data: [paidRow], error: null },
      { data: [persistedNewRow], error: null },
    ];
    const { upsertTeamPaymentsForProject } = await import('../teamProjectPayments');

    const result = await upsertTeamPaymentsForProject('project-1', [newRow as any]);

    expect(upsertMock.mock.calls[0][0]).toHaveLength(1);
    expect(upsertMock.mock.calls[0][0][0].team_member_id).toBe('member-new');
    expect(deleteMock).not.toHaveBeenCalled();
    expect(result.map(payment => payment.teamMemberId)).toEqual(['member-new', 'member-old']);
  });

  it('persists only one fee row per member for duplicate incoming assignments', async () => {
    const firstRow = {
      id: '4d44d2ac-97bb-4cb3-9f61-26a3608719e1',
      projectId: 'project-1',
      teamMemberName: 'Ayu',
      teamMemberId: 'member-1',
      date: '2026-10-13',
      status: 'Unpaid' as const,
      fee: 500000,
    };
    const persistedFirstRow = {
      id: firstRow.id,
      project_id: firstRow.projectId,
      team_member_name: firstRow.teamMemberName,
      team_member_id: firstRow.teamMemberId,
      date: firstRow.date,
      status: firstRow.status,
      fee: firstRow.fee,
    };
    queryResults = [
      { data: [], error: null },
      { data: [persistedFirstRow], error: null },
    ];
    const { upsertTeamPaymentsForProject } = await import('../teamProjectPayments');

    await upsertTeamPaymentsForProject('project-1', [
      firstRow,
      { ...firstRow, id: '833adf4e-611e-45a2-80bb-86f08edc5911', fee: 750000 },
    ]);

    expect(upsertMock.mock.calls[0][0]).toHaveLength(1);
    expect(upsertMock.mock.calls[0][0][0].fee).toBe(500000);
  });
});
