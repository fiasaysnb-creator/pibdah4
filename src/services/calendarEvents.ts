import supabase from '../lib/supabaseClient';
import { CalendarEvent } from '../types';
import { canonicalizeStorageAssetUrls } from './storage';

const TABLE = 'calendar_events';
const PROJECT_MEETING_NOTE_PREFIX = '[weddfin-project-meeting:v1]';

export type ProjectMeetingKind = 'regular' | 'zoom';

export type ProjectMeetingMetadata = {
  projectId: string;
  kind: ProjectMeetingKind;
  zoomUrl: string;
  location: string;
  resultNotes: string;
};

type CalendarEventRow = {
  id: string;
  title: string;
  event_type: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  team?: { memberId?: string }[] | null;
  location?: string | null;
  notes?: string | null;
  tasks?: { id: string; name: string; completed: boolean }[] | null;
  created_at: string;
  updated_at?: string;
};

function formatEventDateTime(date: string, time: string | null | undefined, fallback: string): string {
  const normalizedTime = time?.match(/(\d{2}:\d{2})/)?.[1] || fallback;
  return `${date}T${normalizedTime}:00`;
}

function getTimeValue(value: string): string {
  return value.match(/T(\d{2}:\d{2})/)?.[1] || value.match(/^(\d{2}:\d{2})/)?.[1] || value;
}

function toCalendarEvent(row: CalendarEventRow): CalendarEvent {
  row = canonicalizeStorageAssetUrls(row);
  const startTime = row.start_time || undefined;
  const endTime = row.end_time || undefined;
  const allDay = !startTime && !endTime
    || getTimeValue(startTime || '') === '00:00' && getTimeValue(endTime || '') === '23:59';

  return {
    id: row.id,
    title: row.title,
    eventType: row.event_type as CalendarEvent['eventType'],
    status: 'Confirmed' as CalendarEvent['status'],
    date: row.date,
    startAt: formatEventDateTime(row.date, startTime, '00:00'),
    endAt: formatEventDateTime(row.date, endTime, '23:59'),
    allDay,
    teamMemberId: row.team?.[0]?.memberId,
    location: row.location || undefined,
    notes: row.notes || undefined,
    tasks: row.tasks || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function normalizeCalendarEvent(row: any): CalendarEvent {
  return toCalendarEvent(row as CalendarEventRow);
}

export function encodeProjectMeetingNotes(metadata: ProjectMeetingMetadata): string {
  return `${PROJECT_MEETING_NOTE_PREFIX}${JSON.stringify(metadata)}`;
}

export function parseProjectMeetingNotes(notes?: string): ProjectMeetingMetadata | null {
  if (!notes?.startsWith(PROJECT_MEETING_NOTE_PREFIX)) return null;

  try {
    const value = JSON.parse(notes.slice(PROJECT_MEETING_NOTE_PREFIX.length)) as Partial<ProjectMeetingMetadata>;
    if (
      typeof value.projectId !== 'string'
      || (value.kind !== 'regular' && value.kind !== 'zoom')
      || typeof value.zoomUrl !== 'string'
      || typeof value.location !== 'string'
      || typeof value.resultNotes !== 'string'
    ) {
      console.error('[Supabase][calendar_events.project_meeting] invalid meeting metadata');
      return null;
    }
    return value as ProjectMeetingMetadata;
  } catch (error) {
    console.error('[Supabase][calendar_events.project_meeting] failed to parse meeting metadata:', error);
    return null;
  }
}

export type ProjectMeeting = {
  event: CalendarEvent;
  metadata: ProjectMeetingMetadata;
};

export async function listProjectMeetings(projectId: string): Promise<ProjectMeeting[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,title,event_type,date,start_time,end_time,team,location,notes,tasks,created_at')
    // The project id is the first JSON property written by encodeProjectMeetingNotes.
    // Filter at PostgREST so the portal doesn't download every calendar event per project.
    .ilike('notes', `${PROJECT_MEETING_NOTE_PREFIX}%${JSON.stringify({ projectId })}%`)
    .order('date', { ascending: true });
  if (error) throw error;

  return ((data || []) as CalendarEventRow[])
    .map(toCalendarEvent)
    .flatMap(event => {
      const metadata = parseProjectMeetingNotes(event.notes);
      return metadata?.projectId === projectId ? [{ event, metadata }] : [];
    });
}

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return ((data || []) as CalendarEventRow[]).map(toCalendarEvent);
}

export async function listCalendarEventsInRange(fromDate: string, toDate: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return ((data || []) as CalendarEventRow[]).map(toCalendarEvent);
}

export type CreateCalendarEventInput = {
  title: string;
  eventType: string;
  date: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  projectId?: string;
  clientId?: string;
  teamMemberId?: string;
  vendorId?: string;
  location?: string;
  notes?: string;
  tasks?: { id: string; name: string; completed: boolean }[];
};

function toDatabasePayload(input: Partial<CreateCalendarEventInput>) {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.eventType !== undefined) payload.event_type = input.eventType;
  if (input.date !== undefined) payload.date = input.date;
  if (input.allDay === true) {
    payload.start_time = '00:00:00';
    payload.end_time = '23:59:00';
  } else {
    if (input.startAt !== undefined) payload.start_time = getTimeValue(input.startAt);
    if (input.endAt !== undefined) payload.end_time = getTimeValue(input.endAt);
  }
  if (input.teamMemberId !== undefined) {
    payload.team = input.teamMemberId ? [{ memberId: input.teamMemberId }] : [];
  }
  if (input.location !== undefined) payload.location = input.location;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.tasks !== undefined) payload.tasks = input.tasks;

  return payload;
}

export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([toDatabasePayload(input)])
    .select('*')
    .single();
  if (error) throw error;
  return toCalendarEvent(data as CalendarEventRow);
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>;

export async function updateCalendarEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(toDatabasePayload(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toCalendarEvent(data as CalendarEventRow);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
}
