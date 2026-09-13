import type { Endpoint } from 'payload';
import ExcelJS from 'exceljs';
import { requireAdmin } from './util';
import { REVIEW_STATUSES } from '../fields/review';
import type { ApplicantFile, Form, FormSubmission } from '../payload-types';

/**
 * Admin-only Excel export of one form's submissions:
 *
 *   GET /api/submissions-export.xlsx?form=application
 *   GET /api/submissions-export.xlsx?form=techtour
 *
 * One row per submission: submitted-at, the answers (one column per question,
 * in the form's current order, labelled with the question labels), links to
 * uploaded files (CV), the review status and notes from the CMS, and the
 * campaign attribution. The status column carries a dropdown (accepted /
 * unsure / rejected) so the sheet can be used for the review itself; what is
 * decided there still has to be typed back into the CMS — there is no import.
 */

const REVIEW_LIST = REVIEW_STATUSES.filter((s) => s.value !== 'unreviewed')
  .map((s) => s.label)
  .join(',');

// Absolute origin for file links. The CMS runs on an internal hostname, so the
// request URL is no help; PUBLIC_SITE_ORIGIN wins, then the admin page that
// triggered the download (its Referer), then the production domain.
const siteOrigin = (referer: string | null): string => {
  const env = process.env.PUBLIC_SITE_ORIGIN?.replace(/\/+$/, '');
  if (env) return env;
  try {
    if (referer) return new URL(referer).origin;
  } catch {
    /* ignore malformed referer */
  }
  return 'https://codingforchange.com';
};

/** Column headers stay scannable: long consent sentences fall back to the field name. */
const HEADER_MAX = 40;

type InputBlock = { blockType: string; name?: string; label?: string | null };

/** Question names in form order, with their labels. */
function questionsOf(form: Form): { name: string; label: string; wide: boolean }[] {
  const out: { name: string; label: string; wide: boolean }[] = [];
  for (const block of (form.fields ?? []) as InputBlock[]) {
    if (block.blockType === 'message' || !block.name) continue;
    const label = (block.label || block.name).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    out.push({
      name: block.name,
      label: label.length > HEADER_MAX ? block.name : label,
      wide: block.blockType === 'textarea',
    });
  }
  return out;
}

const yesNo = (v: string) => (v === 'true' ? 'yes' : v === 'false' ? 'no' : v);

export const submissionsExport: Endpoint = {
  path: '/submissions-export.xlsx',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;

    let wanted = '';
    try {
      wanted = (new URL(req.url ?? '', 'http://localhost').searchParams.get('form') ?? '').trim().toLowerCase();
    } catch {
      /* fall through to 400 */
    }
    if (!wanted) return new Response('Missing ?form=<title>', { status: 400 });

    const forms = await req.payload.find({ collection: 'forms', limit: 100, depth: 0, overrideAccess: true });
    const form = forms.docs.find((f) => f.title.trim().toLowerCase() === wanted);
    if (!form) return new Response(`No form titled "${wanted}"`, { status: 404 });

    const { docs } = await req.payload.find({
      collection: 'form-submissions',
      where: { form: { equals: form.id } },
      sort: '-createdAt',
      depth: 1,
      pagination: false,
      overrideAccess: true,
    });
    const subs = docs as FormSubmission[];

    // Current questions first, then anything older submissions still carry.
    const questions = questionsOf(form);
    const known = new Set(questions.map((q) => q.name));
    for (const s of subs) {
      for (const kv of s.submissionData ?? []) {
        if (!known.has(kv.field)) {
          known.add(kv.field);
          questions.push({ name: kv.field, label: kv.field, wide: false });
        }
      }
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Coding for Change CMS';
    wb.created = new Date();
    const ws = wb.addWorksheet(form.title.slice(0, 31));

    ws.columns = [
      { header: 'Submitted', key: 'createdAt', width: 18 },
      { header: 'ID', key: 'id', width: 6 },
      ...questions.map((q) => ({ header: q.label, key: `q_${q.name}`, width: q.wide ? 48 : 22 })),
      { header: 'Files', key: 'files', width: 44 },
      { header: 'Status', key: 'reviewStatus', width: 14 },
      { header: 'Notes', key: 'reviewNotes', width: 48 },
      { header: 'Source', key: 'source', width: 16 },
      { header: 'Channel', key: 'channel', width: 14 },
      { header: 'Landing page', key: 'landingPath', width: 20 },
    ];

    const origin = siteOrigin(req.headers.get('referer'));
    for (const s of subs) {
      const row: Record<string, unknown> = {
        createdAt: new Date(s.createdAt),
        id: s.id,
        files: (s.files ?? [])
          .map((f) => (typeof f === 'object' && f ? `${origin}${(f as ApplicantFile).url ?? ''}` : ''))
          .filter(Boolean)
          .join('\n'),
        reviewStatus:
          REVIEW_STATUSES.find((o) => o.value === s.reviewStatus && o.value !== 'unreviewed')?.label ?? '',
        reviewNotes: s.reviewNotes ?? '',
        source: s.attribution?.source ?? '',
        channel: s.attribution?.channel ?? '',
        landingPath: s.attribution?.landingPath ?? '',
      };
      for (const kv of s.submissionData ?? []) row[`q_${kv.field}`] = yesNo(kv.value);
      ws.addRow(row);
    }

    // Readable sheet: bold frozen header with a filter, dates formatted, long
    // text wrapped, and a dropdown on the status column for reviewing in Excel.
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3EAEA' } };
    header.alignment = { vertical: 'middle' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
    ws.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm';
    const wrapKeys = new Set(['files', 'reviewNotes', ...questions.filter((q) => q.wide).map((q) => `q_${q.name}`)]);
    ws.columns.forEach((col) => {
      if (col.key && wrapKeys.has(col.key)) col.alignment = { wrapText: true, vertical: 'top' };
    });
    const statusCol = ws.getColumn('reviewStatus').number;
    for (let r = 2; r <= Math.max(subs.length + 1, 2); r++) {
      ws.getCell(r, statusCol).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${REVIEW_LIST}"`],
      };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-submissions-${date}.xlsx`;
    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
};
