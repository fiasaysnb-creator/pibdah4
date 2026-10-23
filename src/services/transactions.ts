import supabase from '../lib/supabaseClient';
import { Transaction, TransactionType } from '../types';
import { validateCardBalance } from './balanceValidator';
import { canonicalizeStorageAssetUrls, uploadImageDataUrl } from './storage';

const TRANSACTIONS = 'transactions';
const CARDS = 'cards';

/** Supabase transactions table row (snake_case). */
interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  project_id: string | null;
  category: string;
  method: string;
  pocket_id: string | null;
  card_id: string | null;
  printing_item_id: string | null;
  vendor_signature: string | null;
}

export async function createTransaction(row: Omit<Transaction, 'id' | 'vendorSignature'>): Promise<Transaction> {
  // Validate balance before transaction if card_id is provided
  if (row.cardId && row.type === TransactionType.EXPENSE) {
    // Fetch current card balance
    const { data: card, error: cardError } = await supabase
      .from(CARDS)
      .select('balance')
      .eq('id', row.cardId)
      .single();

    if (cardError) throw cardError;
    if (!card) throw new Error('Card not found');

    // Validate balance
    validateCardBalance(card as any, row.amount, row.type);
  }

  // Use atomic RPC function if card_id is provided
  if (row.cardId) {
    const amountDelta = row.type === TransactionType.INCOME ? row.amount : -row.amount;

    const transactionData: Partial<TransactionRow> = {
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      project_id: row.projectId ?? null,
      category: row.category,
      method: row.method,
      pocket_id: row.pocketId ?? null,
      printing_item_id: row.printingItemId ?? null,
      vendor_signature: null,
    };

    try {
      const { data, error } = await supabase.rpc('create_transaction_with_balance_update', {
        p_transaction_data: transactionData,
        p_card_id: row.cardId,
        p_amount_delta: amountDelta,
      });

      if (error) {
        // If RPC doesn't exist (PGRST202), fallback to manual steps
        if (error.code === 'PGRST202' || error.message.includes('not find the function')) {
          console.warn('[Supabase] RPC missing, falling back to manual transaction creation.');
          const { data: inserted, error: insErr } = await supabase
            .from(TRANSACTIONS)
            .insert([{ ...transactionData, card_id: row.cardId }])
            .select('*')
            .single();
          if (insErr) throw insErr;

          await updateCardBalance(row.cardId, amountDelta);
          return normalizeTransaction(inserted);
        }
        throw error;
      }
      return normalizeTransaction(data);
    } catch (err: any) {
      // Catch network or other errors and double check for missing RPC
      if (err.code === 'PGRST202' || (err.message && err.message.includes('not find the function'))) {
        console.warn('[Supabase] RPC call failed/missing, falling back to manual transaction creation.');
        const { data: inserted, error: insErr } = await supabase
          .from(TRANSACTIONS)
          .insert([{ ...transactionData, card_id: row.cardId }])
          .select('*')
          .single();
        if (insErr) throw insErr;

        await updateCardBalance(row.cardId, amountDelta);
        return normalizeTransaction(inserted);
      }
      throw err;
    }
  }

  // Fallback for transactions without card_id
  const payload = {
    date: row.date,
    description: row.description,
    amount: row.amount,
    type: row.type,
    project_id: row.projectId ?? null,
    category: row.category,
    method: row.method,
    pocket_id: row.pocketId ?? null,
    card_id: row.cardId ?? null,
    printing_item_id: row.printingItemId ?? null,
  };
  const { data, error } = await supabase
    .from(TRANSACTIONS)
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return normalizeTransaction(data);
}

export async function createTransactions(items: Omit<Transaction, 'id' | 'vendorSignature'>[]): Promise<Transaction[]> {
  const rows = items.map(item => denormalizeTransaction(item as Partial<Transaction>));
  const { data, error } = await supabase
    .from(TRANSACTIONS)
    .insert(rows)
    .select('*');

  if (error) throw error;
  return (data || []).map(normalizeTransaction);
}

export async function listTransactions(options: { limit?: number; offset?: number } = {}): Promise<Transaction[]> {
  const limit = options.limit;
  const offset = options.offset || 0;

  let query = supabase
    .from(TRANSACTIONS)
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false });

  if (limit !== undefined) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeTransaction);
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from(TRANSACTIONS)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeTransaction(data) : null;
}

export async function updateCardBalance(cardId: string, delta: number): Promise<void> {
  // increment balance = balance + delta
  const { error } = await supabase.rpc('increment_card_balance', { p_card_id: cardId, p_delta: delta });
  if (error) {
    // fallback: do update with select-then-update (not ideal for concurrency)
    const { data: card, error: selErr } = await supabase.from(CARDS).select('balance').eq('id', cardId).maybeSingle();
    if (selErr) throw selErr;
    const current = Number(card?.balance || 0);
    const { error: updErr } = await supabase.from(CARDS).update({ balance: current + delta }).eq('id', cardId);
    if (updErr) throw updErr;
    return;
  }
}

export function normalizeTransaction(row: any): Transaction {
  row = canonicalizeStorageAssetUrls(row);
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    projectId: row.project_id ?? undefined,
    category: row.category,
    method: row.method as Transaction['method'],
    pocketId: row.pocket_id ?? undefined,
    cardId: row.card_id ?? undefined,
    printingItemId: row.printing_item_id ?? undefined,
    vendorSignature: row.vendor_signature ?? undefined,
    createdAt: row.created_at || row.date,
    updatedAt: row.updated_at ?? undefined,
  };
}

type TransactionPatch = Partial<Omit<Transaction, 'projectId' | 'pocketId' | 'cardId'>> & {
  projectId?: string | null;
  pocketId?: string | null;
  cardId?: string | null;
};

function denormalizeTransaction(patch: TransactionPatch): Partial<TransactionRow> {
  return {
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.projectId !== undefined ? { project_id: patch.projectId ?? null } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.method !== undefined ? { method: patch.method } : {}),
    ...(patch.pocketId !== undefined ? { pocket_id: patch.pocketId ?? null } : {}),
    ...(patch.cardId !== undefined ? { card_id: patch.cardId ?? null } : {}),
    ...(patch.printingItemId !== undefined ? { printing_item_id: patch.printingItemId ?? null } : {}),
    ...(patch.vendorSignature !== undefined ? { vendor_signature: patch.vendorSignature } : {}),
  };
}

export async function updateTransaction(id: string, patch: TransactionPatch): Promise<Transaction> {
  if (patch.vendorSignature?.startsWith('data:image/')) {
    patch = {
      ...patch,
      vendorSignature: await uploadImageDataUrl(patch.vendorSignature, 'transaction-signatures'),
    };
  }

  const payload = denormalizeTransaction(patch);
  const { data, error } = await supabase
    .from(TRANSACTIONS)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeTransaction(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from(TRANSACTIONS).delete().eq('id', id);
  if (error) throw error;
}

export const transactionService = {
  list: listTransactions,
  get: getTransaction,
  add: createTransaction,
  create: createTransaction,
  update: updateTransaction,
  delete: deleteTransaction,
};
