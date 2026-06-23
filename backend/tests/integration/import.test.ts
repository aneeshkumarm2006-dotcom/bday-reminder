import { beforeEach, describe, expect, it } from 'vitest';

import { addPerson, makeApi, signUp, type Api } from '../helpers/api';
import { useTestDb } from '../helpers/db';

type PreviewRow = {
  id: string;
  name: string;
  relationshipTag: string | null;
  phone: string | null;
  dob: { month: number; day: number; year: number | null } | null;
  status: 'ready' | 'duplicate' | 'invalid';
  error: string | null;
  duplicate: { kind: 'existing' | 'batch'; personId: string | null; fullName: string } | null;
};

// Mirrors scripts/smoke-stage7.ts — the CSV exercises ISO + DD/MM + month-name +
// 2-digit-year + quoted-comma + invalid + duplicate (existing & batch) rows.
const SAMPLE_CSV = [
  'name,relationship,date of birth,phone',
  'Alice Adams,Friend,1990-03-05,+15551111', // ISO
  'Bob Brown,Family,15/08/1985,+15552222', // DD/MM/YYYY (15>12 ⇒ day-first)
  'Carol King,Colleague,March 5,+15553333', // month name, no year
  '"Dave, Jr",Friend,5 Jun 92,', // quoted comma + 2-digit year
  ',Friend,1990-01-01,', // no name → invalid
  'Eve Evans,Friend,notadate,', // unreadable date → invalid
  'Frank Foster,Family,1980-12-25,+15558888', // duplicate of an existing person
  'Grace Green,Friend,2000-07-04,', // first Grace
  'Grace Green,Friend,2000-07-04,+15559999', // duplicate within the batch
  'Henry Hill,Friend,03/04/1991,', // ambiguous numeric ⇒ day-first (3 Apr)
].join('\n');

describe('bulk import — preview + commit (Stage 7, FR-6/7/11, §10)', () => {
  useTestDb();
  let api: Api;
  beforeEach(() => {
    ({ api } = makeApi());
  });

  it('requires auth for both /import/preview and /import/commit (401)', async () => {
    const preview = await api.post('/import/preview').send({ csv: 'name,date of birth\nX,2000-01-01' });
    expect(preview.status).toBe(401);
    const commit = await api.post('/import/commit').send({ items: [] });
    expect(commit.status).toBe(401);
  });

  it('400s when neither csv nor candidates is supplied', async () => {
    const u = await signUp(api);
    const res = await api.post('/import/preview').set('Authorization', u.auth).send({});
    expect(res.status).toBe(400);
  });

  it('previews rows as ready/invalid/duplicate WITHOUT creating anything', async () => {
    const u = await signUp(api);

    // Seed an existing person to detect an existing-duplicate against.
    const seed = await addPerson(api, u.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });
    expect(seed.status).toBe(201);

    const res = await api.post('/import/preview').set('Authorization', u.auth).send({ csv: SAMPLE_CSV });
    expect(res.status).toBe(200);

    const rows = res.body.rows as PreviewRow[];
    expect(rows).toHaveLength(10);
    expect(res.body.summary).toEqual({ total: 10, ready: 6, duplicates: 2, invalid: 2 });

    // Nothing is written during preview — only the seeded person exists.
    const people = await api.get('/people').set('Authorization', u.auth);
    expect(people.status).toBe(200);
    expect((people.body.people as unknown[]).length).toBe(1);
  });

  it('parses mixed date formats and flags a clearly-bad row as invalid', async () => {
    const u = await signUp(api);
    const res = await api.post('/import/preview').set('Authorization', u.auth).send({ csv: SAMPLE_CSV });
    expect(res.status).toBe(200);

    const rows = res.body.rows as PreviewRow[];
    const byName = (n: string) => rows.filter((r) => r.name === n);

    // ISO 1990-03-05 → {3,5,1990}
    const alice = byName('Alice Adams')[0];
    expect(alice.status).toBe('ready');
    expect(alice.dob).toEqual({ month: 3, day: 5, year: 1990 });

    // 15/08/1985 → day-first {8,15,1985} (15>12 disambiguates)
    const bob = byName('Bob Brown')[0];
    expect(bob.dob).toEqual({ month: 8, day: 15, year: 1985 });

    // "March 5" → {3,5,null} (year omitted, FR-14)
    const carol = byName('Carol King')[0];
    expect(carol.dob).toEqual({ month: 3, day: 5, year: null });

    // quoted "Dave, Jr" keeps its comma; "5 Jun 92" → {6,5,1992}
    const dave = byName('Dave, Jr')[0];
    expect(dave).toBeDefined();
    expect(dave.dob).toEqual({ month: 6, day: 5, year: 1992 });

    // ambiguous 03/04/1991 → day-first (3 April)
    const henry = byName('Henry Hill')[0];
    expect(henry.dob?.month).toBe(4);
    expect(henry.dob?.day).toBe(3);

    // a row with no name is invalid and the error mentions the name fix
    const noName = rows.find((r) => r.name === '')!;
    expect(noName.status).toBe('invalid');
    expect(noName.error ?? '').toMatch(/name/i);

    // an unreadable date is invalid and quotes the bad value back
    const eve = byName('Eve Evans')[0];
    expect(eve.status).toBe('invalid');
    expect(eve.error ?? '').toMatch(/notadate/);
  });

  it('flags an existing-person duplicate and an in-batch duplicate', async () => {
    const u = await signUp(api);
    const seed = await addPerson(api, u.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });
    const frankId: string = seed.body.person.id;

    const res = await api.post('/import/preview').set('Authorization', u.auth).send({ csv: SAMPLE_CSV });
    const rows = res.body.rows as PreviewRow[];
    const byName = (n: string) => rows.filter((r) => r.name === n);

    // CSV row matching an existing person → duplicate (existing) pointing at it.
    const frankRow = byName('Frank Foster')[0];
    expect(frankRow.status).toBe('duplicate');
    expect(frankRow.duplicate?.kind).toBe('existing');
    expect(frankRow.duplicate?.personId).toBe(frankId);

    // Two identical rows in one import → the second is a duplicate (batch).
    const graceRows = byName('Grace Green');
    expect(graceRows[0].status).toBe('ready');
    expect(graceRows[1].status).toBe('duplicate');
    expect(graceRows[1].duplicate?.kind).toBe('batch');
    expect(graceRows[1].duplicate?.personId).toBeNull();
  });

  it('dedup is per-owner — another user\'s identical person is NOT flagged', async () => {
    const owner = await signUp(api);
    await addPerson(api, owner.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });

    const other = await signUp(api);
    const res = await api
      .post('/import/preview')
      .set('Authorization', other.auth)
      .send({ csv: 'name,date of birth\nFrank Foster,1980-12-25' });
    expect(res.status).toBe(200);
    expect((res.body.rows as PreviewRow[])[0].status).toBe('ready');
  });

  it('commits add/merge/skip and returns matching summary counts', async () => {
    const u = await signUp(api);
    const seed = await addPerson(api, u.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });
    const frankId: string = seed.body.person.id;

    const preview = await api.post('/import/preview').set('Authorization', u.auth).send({ csv: SAMPLE_CSV });
    const rows = preview.body.rows as PreviewRow[];
    const byName = (n: string) => rows.filter((r) => r.name === n);
    const graceRows = byName('Grace Green');
    const frankRow = byName('Frank Foster')[0];

    const mk = (r: PreviewRow, resolution: 'add' | 'skip') => ({
      name: r.name,
      relationshipTag: r.relationshipTag,
      phone: r.phone,
      dob: r.dob,
      resolution,
    });

    const items = [
      ...['Alice Adams', 'Bob Brown', 'Carol King', 'Dave, Jr', 'Henry Hill'].map((n) => mk(byName(n)[0], 'add')),
      mk(graceRows[0], 'add'), // keep the first Grace
      mk(graceRows[1], 'skip'), // drop the in-batch duplicate
      {
        name: frankRow.name,
        relationshipTag: frankRow.relationshipTag,
        phone: frankRow.phone,
        dob: frankRow.dob,
        resolution: 'merge' as const,
        mergeTargetId: frankId,
      },
    ];

    const res = await api.post('/import/commit').set('Authorization', u.auth).send({ items });
    expect(res.status).toBe(201);
    expect(res.body.summary).toEqual({ added: 6, merged: 1, skipped: 1, total: 8 });

    // 6 added + the pre-existing Frank = 7 people; the skipped Grace dup is not created.
    const people = await api.get('/people').set('Authorization', u.auth);
    const list = people.body.people as { id: string; fullName: string }[];
    expect(list).toHaveLength(7);
    expect(list.filter((p) => p.fullName === 'Grace Green')).toHaveLength(1);
  });

  it('merge fills only EMPTY fields and never overwrites a populated value (§10)', async () => {
    const u = await signUp(api);
    // Frank has a tag but NO phone — merge should fill the phone, keep the tag.
    const seed = await addPerson(api, u.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });
    const frankId: string = seed.body.person.id;

    const res = await api
      .post('/import/commit')
      .set('Authorization', u.auth)
      .send({
        items: [
          {
            name: 'Frank Foster',
            relationshipTag: 'Family', // a different, populated tag in the import
            phone: '+15558888',
            dob: { month: 12, day: 25, year: 1980 },
            resolution: 'merge',
            mergeTargetId: frankId,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.summary).toEqual({ added: 0, merged: 1, skipped: 0, total: 1 });

    const detail = await api.get(`/people/${frankId}`).set('Authorization', u.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.person.phone).toBe('+15558888'); // empty field filled
    expect(detail.body.person.relationshipTag).toBe('Cousin'); // populated value preserved
  });

  it('400s a merge with no target', async () => {
    const u = await signUp(api);
    const res = await api
      .post('/import/commit')
      .set('Authorization', u.auth)
      .send({ items: [{ name: 'Z', dob: { month: 5, day: 5 }, resolution: 'merge' }] });
    expect(res.status).toBe(400);
  });

  it('skips (does not apply) a merge into another user\'s person — ownership (§10)', async () => {
    const owner = await signUp(api);
    const seed = await addPerson(api, owner.auth, {
      fullName: 'Frank Foster',
      relationshipTag: 'Cousin',
      dob: { month: 12, day: 25, year: 1980 },
    });
    const frankId: string = seed.body.person.id;

    const other = await signUp(api);
    const res = await api
      .post('/import/commit')
      .set('Authorization', other.auth)
      .send({
        items: [{ name: 'Z', dob: { month: 5, day: 5 }, resolution: 'merge', mergeTargetId: frankId }],
      });
    expect(res.status).toBe(201);
    expect(res.body.summary.skipped).toBe(1);
    expect(res.body.summary.merged).toBe(0);
  });

  it('contacts preview: only a candidate with a valid birthday is importable (FR-6)', async () => {
    const u = await signUp(api);
    const res = await api
      .post('/import/preview')
      .set('Authorization', u.auth)
      .send({
        candidates: [
          { name: 'Iris Ito', phone: '+1', dob: { month: 2, day: 14, year: 1995 } },
          { name: 'Jack Jones', dob: null }, // no birthday → not importable
          { name: '', dob: { month: 1, day: 1 } }, // no name
          { name: 'Kate Kim', dob: { month: 13, day: 1 } }, // impossible date
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.summary.ready).toBe(1);
    expect(res.body.summary.invalid).toBe(3);

    const iris = (res.body.rows as PreviewRow[]).find((r) => r.name === 'Iris Ito')!;
    expect(iris.status).toBe('ready');
    expect(iris.dob?.month).toBe(2);
    expect(iris.dob?.day).toBe(14);
  });
});
