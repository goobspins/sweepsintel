import type { APIRoute } from 'astro';

import { isHttpError, requireAuth } from '../../../../lib/auth';
import { addCasinoToTracker } from '../../../../lib/tracker';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'Upload a .txt or .csv file.' }, 400);
    }

    if (file.size > 1024 * 1024) {
      return json({ error: 'File must be 1MB or smaller.' }, 400);
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.txt') && !filename.endsWith('.csv')) {
      return json({ error: 'Only .txt and .csv files are supported.' }, 400);
    }

    const text = await file.text();
    const names = text
      .split(/\r?\n/)
      .flatMap((line) => line.split(','))
      .map((line) => line.trim())
      .filter(Boolean);

    let added = 0;
    let matchedExisting = 0;
    let createdSuggested = 0;
    let skippedDuplicate = 0;

    for (const name of names) {
      const result = await addCasinoToTracker({
        userId: user.userId,
        casinoName: name,
        fireAffiliate: false,
      });

      if (result.skippedDuplicate) {
        skippedDuplicate += 1;
        continue;
      }

      added += 1;
      if (result.matchedExisting) {
        matchedExisting += 1;
      }
      if (result.createdSuggested) {
        createdSuggested += 1;
      }
    }

    return json({
      success: true,
      added,
      matched_existing: matchedExisting,
      created_suggested: createdSuggested,
      skipped_duplicate: skippedDuplicate,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json({ error: error.message }, error.status === 302 ? 401 : error.status);
    }
    console.error('tracker/bulk-import failed', error);
    return json({ error: 'Unable to import casinos.' }, 500);
  }
};



