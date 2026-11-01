import { beforeEach, describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET as listReports, POST as createReport } from '@/app/api/reports/route';
import { DELETE as deleteReport, PATCH as updateNotes } from '@/app/api/reports/[id]/route';
import { GET as viewReport, REPORT_CSP } from '@/app/api/reports/[id]/view/route';
import { MAX_REPORT_BYTES } from '@/lib/utils/reports';
import { createTestUser, query, resetDatabase } from '../helpers/db.js';
import { call, readJson, routeParams } from '../helpers/http.js';

beforeEach(resetDatabase);

const html = '<!DOCTYPE html><html><head><title>R</title></head><body><h1>Radiografía</h1></body></html>';
const validBody = { title: 'Radiografía 2026', periodStart: '2025-08', periodEnd: '2026-08', html, notes: 'primera' };

describe('POST /api/reports', () => {
  test('guarda el informe y devuelve metadatos sin el HTML', async () => {
    const { user, authHeaders } = await createTestUser();
    const { status, json } = await call(createReport, '/api/reports', { method: 'POST', headers: authHeaders, body: validBody });

    expect(status).toBe(201);
    expect(json.report).toMatchObject({ title: 'Radiografía 2026', periodStart: '2025-08', periodEnd: '2026-08', notes: 'primera', sizeBytes: Buffer.byteLength(html) });
    expect(json.report.html).toBeUndefined();

    const rows = await query('SELECT user_id, html FROM portfolio_reports');
    expect(rows[0].user_id).toBe(user.id);
    expect(rows[0].html).toBe(html);
  });

  test('validaciones de título, periodo, HTML y tamaño', async () => {
    const { authHeaders } = await createTestUser();
    const post = (body) => call(createReport, '/api/reports', { method: 'POST', headers: authHeaders, body });

    expect((await post({ ...validBody, title: '' })).json.error).toBe('El título es obligatorio');
    expect((await post({ ...validBody, periodStart: '2026-9' })).json.error).toBe('El periodo debe indicarse en formato YYYY-MM');
    expect((await post({ ...validBody, periodStart: '2027-01' })).json.error).toBe('El mes inicial no puede ser posterior al mes final');
    expect((await post({ ...validBody, html: 'texto plano' })).json.error).toBe('El archivo no parece un documento HTML válido');
    expect((await post({ ...validBody, html: `<html>${'x'.repeat(MAX_REPORT_BYTES)}</html>` })).status).toBe(413);
    expect((await call(createReport, '/api/reports', { method: 'POST', headers: authHeaders, body: 'nope' })).status).toBe(400);
    expect((await call(createReport, '/api/reports', { method: 'POST', body: validBody })).status).toBe(401);
  });
});

describe('GET /api/reports', () => {
  test('lista solo los informes del usuario, ordenados por periodo', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    await call(createReport, '/api/reports', { method: 'POST', headers: owner.authHeaders, body: { ...validBody, periodEnd: '2026-03', title: 'Antiguo' } });
    await call(createReport, '/api/reports', { method: 'POST', headers: owner.authHeaders, body: { ...validBody, periodEnd: '2026-08', title: 'Nuevo' } });
    await call(createReport, '/api/reports', { method: 'POST', headers: other.authHeaders, body: validBody });

    const { json } = await call(listReports, '/api/reports', { headers: owner.authHeaders });
    expect(json.reports.map((r) => r.title)).toEqual(['Nuevo', 'Antiguo']);
    expect(json.reports[0].html).toBeUndefined();
  });
});

describe('/api/reports/[id]', () => {
  async function createOne(authHeaders) {
    const { json } = await call(createReport, '/api/reports', { method: 'POST', headers: authHeaders, body: validBody });
    return json.report.id;
  }

  test('PATCH actualiza o borra las notas', async () => {
    const { authHeaders } = await createTestUser();
    const id = await createOne(authHeaders);
    const params = { id: String(id) };

    const updated = await call(updateNotes, `/api/reports/${id}`, { method: 'PATCH', headers: authHeaders, body: { notes: '  nuevas notas ' } }, params);
    expect(updated.status).toBe(200);
    expect(updated.json.report.notes).toBe('nuevas notas');

    const cleared = await call(updateNotes, `/api/reports/${id}`, { method: 'PATCH', headers: authHeaders, body: { notes: '' } }, params);
    expect(cleared.json.report.notes).toBeNull();

    expect((await call(updateNotes, `/api/reports/${id}`, { method: 'PATCH', headers: authHeaders, body: { notes: 5 } }, params)).status).toBe(400);
    expect((await call(updateNotes, '/api/reports/999', { method: 'PATCH', headers: authHeaders, body: { notes: 'x' } }, { id: '999' })).status).toBe(404);
  });

  test('DELETE solo informes propios', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const id = await createOne(owner.authHeaders);
    const params = { id: String(id) };

    expect((await call(deleteReport, `/api/reports/${id}`, { method: 'DELETE', headers: other.authHeaders }, params)).status).toBe(404);
    expect((await call(deleteReport, `/api/reports/${id}`, { method: 'DELETE', headers: owner.authHeaders }, params)).status).toBe(200);
    expect(await query('SELECT id FROM portfolio_reports')).toHaveLength(0);
  });

  test('GET /view devuelve el HTML con CSP, por cabecera o por cookie', async () => {
    const { token, authHeaders } = await createTestUser();
    const id = await createOne(authHeaders);

    const viaHeader = await viewReport(new NextRequest(`http://localhost/api/reports/${id}/view`, { headers: authHeaders }), routeParams({ id: String(id) }));
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.headers.get('content-type')).toContain('text/html');
    expect(viaHeader.headers.get('content-security-policy')).toBe(REPORT_CSP);
    expect(viaHeader.headers.get('cache-control')).toBe('private, no-store');
    expect(await viaHeader.text()).toBe(html);

    const viaCookie = await viewReport(new NextRequest(`http://localhost/api/reports/${id}/view`, { headers: { cookie: `auth_token=${token}` } }), routeParams({ id: String(id) }));
    expect(viaCookie.status).toBe(200);

    const anonymous = await viewReport(new NextRequest(`http://localhost/api/reports/${id}/view`), routeParams({ id: String(id) }));
    expect((await readJson(anonymous)).status).toBe(401);

    const other = await createTestUser();
    const foreign = await viewReport(new NextRequest(`http://localhost/api/reports/${id}/view`, { headers: other.authHeaders }), routeParams({ id: String(id) }));
    expect(foreign.status).toBe(404);
  });
});
