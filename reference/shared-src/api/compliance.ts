/**
 * ACT — driver onboarding and compliance
 *
 * ── Why documents never get a public URL ───────────────────────────────────
 * The `driver-docs` bucket is private. Reading a file means asking Supabase
 * for a signed URL that expires in minutes. That matters because a public URL
 * to a passport scan is permanent: pasted into a support chat, forwarded in an
 * email, or logged by a proxy, it stays fetchable by anyone forever. A signed
 * URL that dies in five minutes limits the damage of every one of those.
 *
 * ── What is deliberately absent ────────────────────────────────────────────
 * There is no field anywhere here for an email account password. See the note
 * in the migration: collecting one would hand AC7 the ability to read a
 * driver's private mail and reset their bank login, and password reuse means
 * a breach would reach far beyond AC7. Drivers authenticate with Supabase
 * Auth, which stores a bcrypt hash nobody at AC7 can read.
 */

import { supabase } from '@shared/lib/supabase';

export type VehicleCategory = 'car' | 'motorbike' | 'bicycle';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'more_info'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type DocStatus = 'missing' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface DocumentRow {
  doc_type: string;
  label: string;
  description: string;
  is_required: boolean;
  has_expiry: boolean;
  sort_order: number;
  status: DocStatus;
  expires_on: string | null;
  uploaded_at: string | null;
  reject_reason: string | null;
}

export interface DriverCompliance {
  driver_id: string;
  date_of_birth: string | null;
  national_insurance_no: string | null;
  dvla_licence_no: string | null;
  dvla_licence_expiry: string | null;
  phv_driver_licence_no: string | null;
  phv_driver_licence_expiry: string | null;
  phv_vehicle_licence_no: string | null;
  phv_vehicle_licence_expiry: string | null;
  insurance_provider: string | null;
  insurance_policy_no: string | null;
  insurance_expiry: string | null;
  insurance_is_hire_and_reward: boolean;
  mot_expiry: string | null;
  right_to_work_verified: boolean;
  right_to_work_expiry: string | null;
  dbs_certificate_no: string | null;
  dbs_issued_on: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

const BUCKET = 'driver-docs';

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** Checklist for a driver. Omit the id for the signed-in driver's own. */
export async function documentStatus(driverId?: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase.rpc('driver_document_status', {
    p_driver_id: driverId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export async function myDriverRecord() {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', (await currentUserId()) ?? '')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', data.user.id)
    .maybeSingle();
  return (row as { id: string } | null)?.id ?? null;
}

export async function compliance(driverId: string): Promise<DriverCompliance | null> {
  const { data, error } = await supabase
    .from('driver_compliance')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DriverCompliance | null;
}

export async function saveCompliance(
  driverId: string,
  patch: Partial<DriverCompliance>,
): Promise<void> {
  const { error } = await supabase
    .from('driver_compliance')
    .upsert({ driver_id: driverId, ...patch }, { onConflict: 'driver_id' });
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Uploading                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Shrink a photo before upload.
 *
 * Drivers photograph documents on phones that produce 4–12 MB files, over
 * mobile data, often standing outside. Resizing to 2000px on the long edge
 * keeps a bank statement comfortably legible while cutting a 9 MB upload to
 * roughly 600 kB — the difference between an upload that completes and one
 * that is abandoned halfway through.
 *
 * PDFs pass through untouched: rasterising them would destroy selectable text
 * and usually make the file bigger.
 */
async function compress(file: File): Promise<Blob> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // HEIC on a browser that cannot decode it

  const MAX = 2000;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );

  // If compression somehow made it larger, keep the original.
  return blob && blob.size < file.size ? blob : file;
}

export async function uploadDocument(
  driverId: string,
  docType: string,
  file: File,
  expiresOn?: string | null,
): Promise<void> {
  const body = await compress(file);
  const ext = body.type === 'application/pdf' ? 'pdf' : 'jpg';

  /* Path is `<driver_id>/<doc_type>.<ext>`. The storage policy compares the
     first segment against the caller's driver id, so a driver editing the URL
     to another driver's folder is refused by the database rather than by the
     application. */
  const path = `${driverId}/${docType}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { upsert: true, contentType: body.type || 'image/jpeg' });
  if (upErr) throw new Error(upErr.message);

  const { error } = await supabase.from('driver_documents').upsert(
    {
      driver_id: driverId,
      doc_type: docType,
      storage_path: path,
      original_name: file.name,
      mime_type: body.type,
      size_bytes: body.size,
      // Re-uploading resets the decision: a replaced document has not been
      // reviewed, whatever the verdict on the one it replaced.
      status: 'pending',
      reject_reason: null,
      expires_on: expiresOn || null,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: 'driver_id,doc_type' },
  );
  if (error) throw new Error(error.message);
}

/** Short-lived URL for viewing one document. Admin or the owning driver. */
export async function documentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300); // five minutes
  if (error) return null;
  return data?.signedUrl ?? null;
}

/* -------------------------------------------------------------------------- */
/* Submission and review                                                      */
/* -------------------------------------------------------------------------- */

/** Throws with a readable list of what is still outstanding. */
export async function submitApplication(): Promise<void> {
  const { error } = await supabase.rpc('submit_driver_application');
  if (error) throw new Error(error.message);
}

export async function reviewDocument(
  documentId: string,
  status: 'approved' | 'rejected',
  reason = '',
): Promise<void> {
  const { error } = await supabase.rpc('review_driver_document', {
    p_document_id: documentId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function reviewApplication(
  driverId: string,
  status: 'approved' | 'rejected' | 'more_info' | 'suspended',
  notes = '',
): Promise<void> {
  const { error } = await supabase.rpc('review_driver_application', {
    p_driver_id: driverId,
    p_status: status,
    p_notes: notes,
  });
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Admin listing                                                              */
/* -------------------------------------------------------------------------- */

export interface AdminDriverRow {
  id: string;
  driver_code: string;
  user_id: string;
  vehicle_category: VehicleCategory;
  application_status: ApplicationStatus;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  rating: number | null;
  total_rides: number | null;
  presence: string;
  created_at: string;
}

export async function adminListDrivers(): Promise<AdminDriverRow[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select(
      'id, driver_code, user_id, vehicle_category, application_status, vehicle_make, vehicle_model, vehicle_plate, vehicle_color, rating, total_rides, presence, created_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminDriverRow[];
}

export async function adminDriverDocuments(driverId: string) {
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Not submitted',
  submitted: 'Waiting for review',
  more_info: 'Needs more from the driver',
  approved: 'Approved to drive',
  rejected: 'Refused',
  suspended: 'Suspended',
};

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  car: 'Car — private hire',
  motorbike: 'Motorbike — delivery',
  bicycle: 'Bicycle — delivery',
};
