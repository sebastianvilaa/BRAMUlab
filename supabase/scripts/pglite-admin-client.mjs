// BRAMUlab — Bloque 9B: cliente "service_role" FALSO respaldado por PGlite (la base replayada de 9A), con la MISMA forma que
// usa el código operativo real (`supabase-js`: rpc / from().select().eq() / storage / auth.admin). Permite ensayar los
// procedimientos administrativos (eliminación, export, cleanup) end-to-end contra una base efímera con fixtures, sin
// credenciales ni cuentas reales. NO es GoTrue ni la Storage API: su alcance está documentado en el 87 (límites).

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

export function makePgliteAdminClient(db, { failOn = {} } = {}) {
  const fail = (key) => { if (failOn[key] && failOn[key] > 0) { failOn[key] -= 1; return true; } return false; };
  const calls = [];

  async function rpc(name, args = {}) {
    calls.push(['rpc', name]);
    if (fail(`rpc:${name}`)) return { data: null, error: { message: `simulated failure rpc ${name}` } };
    try {
      const keys = Object.keys(args);
      const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
      const meta = (await db.query(`select proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [name])).rows[0];
      if (!meta) return { data: null, error: { message: `function public.${name} does not exist` } };
      const params = keys.map((k) => args[k]);
      if (meta.proretset) return { data: (await db.query(`select * from public.${ident(name)}(${named})`, params)).rows, error: null };
      return { data: (await db.query(`select public.${ident(name)}(${named}) as r`, params)).rows[0].r, error: null };
    } catch (e) { return { data: null, error: { message: String(e.message || e) } }; }
  }

  function from(table) {
    const q = { cols: '*', filters: [], order: null, lim: null };
    const run = async (single) => {
      calls.push(['from', table]);
      if (fail(`from:${table}`)) return { data: null, error: { message: `simulated failure from ${table}` } };
      try {
        const params = []; const where = q.filters.map((f) => { params.push(f.v); return `${ident(f.c)} = $${params.length}`; });
        const sql = `select ${q.cols} from public.${ident(table)}${where.length ? ` where ${where.join(' and ')}` : ''}${q.order ? ` order by ${ident(q.order.c)} ${q.order.asc ? 'asc' : 'desc'}` : ''}${q.lim ? ` limit ${Number(q.lim)}` : ''}`;
        const rows = (await db.query(sql, params)).rows;
        return { data: single ? (rows[0] || null) : rows, error: null };
      } catch (e) { return { data: null, error: { message: String(e.message || e) } }; }
    };
    const b = {
      select(cols) { q.cols = cols || '*'; return b; },
      eq(c, v) { q.filters.push({ c, v }); return b; },
      order(c, o) { q.order = { c, asc: !o || o.ascending !== false }; return b; },
      limit(n) { q.lim = n; return b; },
      maybeSingle: () => run(true),
      then(res, rej) { return run(false).then(res, rej); },
    };
    return b;
  }

  const storage = {
    from: (bucket) => ({
      async list(prefix) {
        calls.push(['storage.list', bucket]);
        if (fail('storage.list')) return { data: null, error: { message: 'simulated storage list failure' } };
        const rows = (await db.query(`select name from storage.objects where bucket_id = $1 and name like $2`, [bucket, `${prefix}/%`])).rows;
        return { data: rows.map((r) => ({ name: r.name.slice(prefix.length + 1) })), error: null };
      },
      async remove(paths) {
        calls.push(['storage.remove', bucket]);
        if (fail('storage.remove')) return { data: null, error: { message: 'simulated storage remove failure' } };
        for (const p of paths) await db.query(`delete from storage.objects where bucket_id = $1 and name = $2`, [bucket, p]);
        return { data: paths, error: null };
      },
    }),
  };

  const auth = {
    admin: {
      async getUserById(id) {
        const r = (await db.query(`select id, email, email_confirmed_at, created_at, phone_confirmed_at, last_sign_in_at, banned_until from auth.users where id = $1`, [id])).rows[0];
        return r ? { data: { user: r }, error: null } : { data: { user: null }, error: { status: 404, message: 'User not found' } };
      },
      async updateUserById(id, attrs) {
        if (fail('auth.ban')) return { data: null, error: { status: 500, message: 'simulated ban failure' } };
        const r = await db.query(`update auth.users set banned_until = now() + interval '100 years' where id = $1 returning id`, [id]);
        return r.rows.length ? { data: { user: { id } }, error: null } : { data: null, error: { status: 404, message: 'User not found' } };
      },
      async deleteUser(id) {
        calls.push(['auth.deleteUser', id]);
        if (fail('auth.delete')) return { data: null, error: { status: 500, message: 'simulated auth delete failure' } };
        const r = await db.query(`delete from auth.users where id = $1 returning id`, [id]);
        return r.rows.length ? { data: {}, error: null } : { data: null, error: { status: 404, message: 'User not found' } };
      },
    },
  };

  return { rpc, from, storage, auth, calls };
}
