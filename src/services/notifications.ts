import supabase from '../lib/supabaseClient';
import { Notification, ViewType } from '../types';

const TABLE = 'notifications';

function normalize(row: any): Notification {
  return {
    id: row.id,
    title: row.title ?? '',
    message: row.message ?? '',
    timestamp: row.timestamp,
    isRead: Boolean(row.is_read),
    icon: row.icon as Notification['icon'],
    link: row.link ? ({
      view: (row.link.view as ViewType),
      action: row.link.action ?? undefined,
    }) : undefined,
  };
}

function denormalize(obj: Partial<Notification>): any {
  return {
    ...(obj.title !== undefined ? { title: obj.title } : {}),
    ...(obj.message !== undefined ? { message: obj.message } : {}),
    ...(obj.timestamp !== undefined ? { timestamp: obj.timestamp } : {}),
    ...(obj.isRead !== undefined ? { is_read: obj.isRead } : {}),
    ...(obj.icon !== undefined ? { icon: obj.icon } : {}),
    ...(obj.link !== undefined ? { link: obj.link } : {}),
  };
}

export async function listNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

import { dispatchWebPush } from './webPush';
import { getProfile } from './profile';

export async function createNotification(
  payload: Omit<Notification, 'id'> & { vendor_id?: string }
): Promise<Notification> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ ...denormalize(payload) }])
    .select('*')
    .single();
  if (error) throw error;
  const created = normalize(data);

  // Dispatch Web Push notification in the background without blocking execution
  void (async () => {
    try {
      let vendorId = payload.vendor_id;
      if (!vendorId) {
        const prof = await getProfile().catch((): null => null);
        vendorId = prof?.id;
      }
      if (vendorId) {
        await dispatchWebPush({
          vendor_id: vendorId,
          title: created.title,
          message: created.message,
          url: created.link?.view ? `/#/${created.link.view}` : '/',
          tag: created.icon || 'vena-notification',
        });
      }
    } catch (pushErr) {
      console.warn('[Notifications] Background web push dispatch warning:', pushErr);
    }
  })();

  return created;
}

export async function updateNotification(id: string, patch: Partial<Notification>): Promise<Notification> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(denormalize(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
}
