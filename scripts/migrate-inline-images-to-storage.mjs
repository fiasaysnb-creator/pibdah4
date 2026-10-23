import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_MEDIA_BUCKET || 'gallery-images';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment before running this script.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mediaColumns = [
  ['packages', 'cover_image'],
  ['profiles', 'logo_base64'],
  ['profiles', 'signature_base64'],
  ['projects', 'invoice_signature'],
  ['transactions', 'vendor_signature'],
  ['team_payment_records', 'vendor_signature'],
  ['contracts', 'vendor_signature'],
  ['contracts', 'client_signature'],
];

function safePathPart(value) {
  return encodeURIComponent(String(value)).replaceAll('%', '_');
}

function decodeDataUrl(value) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,([\s\S]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function convertImage(buffer, mimeType) {
  if (mimeType === 'image/gif' || mimeType === 'image/svg+xml') {
    const extension = mimeType === 'image/gif' ? 'gif' : 'svg';
    return { buffer, mimeType, extension };
  }

  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return { buffer: optimized, mimeType: 'image/webp', extension: 'webp' };
}

async function migrateColumn(table, column) {
  let migrated = 0;
  let beforeBytes = 0;
  let afterBytes = 0;

  // Query from the beginning each time because successfully migrated rows no
  // longer match the data URL filter. This also makes interrupted runs resumable.
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`id,${column}`)
      .like(column, 'data:image/%')
      .limit(25);

    if (error) throw new Error(`${table}.${column} read failed: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      const decoded = decodeDataUrl(row[column]);
      if (!decoded) {
        throw new Error(`${table}.${column} row ${row.id} uses an unsupported image data URL format.`);
      }

      const converted = await convertImage(decoded.buffer, decoded.mimeType);
      const path = `migrated-inline/${table}/${safePathPart(row.id)}/${column}.${converted.extension}`;
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, converted.buffer, {
        contentType: converted.mimeType,
        cacheControl: '31536000',
        upsert: true,
      });
      if (uploadError) throw new Error(`${table}.${column} upload failed for row ${row.id}: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from(table)
        .update({ [column]: urlData.publicUrl })
        .eq('id', row.id);

      if (updateError) {
        await supabase.storage.from(bucketName).remove([path]);
        throw new Error(`${table}.${column} update failed for row ${row.id}: ${updateError.message}`);
      }

      migrated += 1;
      beforeBytes += Buffer.byteLength(row[column], 'utf8');
      afterBytes += Buffer.byteLength(urlData.publicUrl, 'utf8');
    }
  }

  console.log(`${table}.${column}: migrated ${migrated}; DB text ${beforeBytes} -> ${afterBytes} bytes`);
}

for (const [table, column] of mediaColumns) {
  await migrateColumn(table, column);
}

console.log('Inline image migration complete. Re-run to verify all supported data URLs were converted.');
