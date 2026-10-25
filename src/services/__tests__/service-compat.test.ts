import { describe, it, expect } from 'vitest';
import { clientService } from '../clients';
import { transactionService } from '../transactions';
import { teamMemberService } from '../teamMembers';
import { teamProjectPaymentService } from '../teamProjectPayments';
import { projectService } from '../projects';

describe('service compatibility exports', () => {
  it('exposes singleton service objects', () => {
    expect(clientService).toBeTruthy();
    expect(typeof clientService.add).toBe('function');

    expect(transactionService).toBeTruthy();
    expect(typeof transactionService.add).toBe('function');

    expect(teamMemberService).toBeTruthy();
    expect(typeof teamMemberService.add).toBe('function');

    expect(teamProjectPaymentService).toBeTruthy();
    expect(typeof teamProjectPaymentService.add).toBe('function');

    expect(projectService).toBeTruthy();
    expect(typeof projectService.add).toBe('function');
  });
});
