const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const ALLOWED_ORIGINS = [
  'https://ctt-academy.pages.dev',
  'https://cooperteachestennis.github.io',
];

const FRONTEND_URL = ALLOWED_ORIGINS[0];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Player-Id, X-Coach-Token',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...cors },
  });
}

function err(message, status = 400, cors = {}) {
  return json({ error: message }, status, cors);
}

function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: location, ...SECURITY_HEADERS },
  });
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  return crypto.randomUUID();
}

function isActive(player) {
  return player && player.active !== false;
}

async function validateOwnerSession(request, env) {
  const token = request.headers.get('X-Coach-Token');
  if (!token) return null;
  try {
    const session = await env.CTT_KV.get(`owner:session:${token}`, { type: 'json' });
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      await env.CTT_KV.delete(`owner:session:${token}`);
      return null;
    }
    const allowedIds = String(env.OWNER_GITHUB_ID).split(',').map(s => s.trim());
    if (!allowedIds.includes(String(session.githubUserId))) return null;
    return session;
  } catch {
    return null;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function handleAuthGithub(request, env) {
  const state = generateToken();
  await env.CTT_KV.put(`oauth:state:${state}`, JSON.stringify({ used: false }), { expirationTtl: 600 });

  const callbackUrl = new URL(request.url);
  callbackUrl.pathname = '/api/auth/callback';
  callbackUrl.search = '';

  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  githubUrl.searchParams.set('scope', 'read:user');
  githubUrl.searchParams.set('state', state);

  return redirect(githubUrl.toString());
}

async function handleAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) return err('Missing code or state', 400);

  const stateRecord = await env.CTT_KV.get(`oauth:state:${state}`, { type: 'json' });
  if (!stateRecord || stateRecord.used) return err('Invalid or expired state', 400);

  await env.CTT_KV.put(`oauth:state:${state}`, JSON.stringify({ used: true }), { expirationTtl: 60 });

  const callbackUrl = new URL(request.url);
  callbackUrl.pathname = '/api/auth/callback';
  callbackUrl.search = '';

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl.toString(),
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return err('GitHub token exchange failed', 502);

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'CooperTeachesTennis',
    },
  });
  const githubUser = await userRes.json();

  const allowedIds = String(env.OWNER_GITHUB_ID).split(',').map(s => s.trim());
  if (!allowedIds.includes(String(githubUser.id))) {
    return err('Access denied', 403);
  }

  const sessionToken = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await env.CTT_KV.put(
    `owner:session:${sessionToken}`,
    JSON.stringify({
      githubUserId: githubUser.id,
      githubLogin: githubUser.login,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${FRONTEND_URL}/dashboard.html#session=${sessionToken}`,
      ...SECURITY_HEADERS,
    },
  });
}

async function handleAuthCheck(request, env, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return json({ authenticated: false }, 401, cors);
  return json({ authenticated: true, login: session.githubLogin }, 200, cors);
}

async function handleAuthLogout(request, env, cors) {
  const token = request.headers.get('X-Coach-Token');
  if (token) await env.CTT_KV.delete(`owner:session:${token}`);
  return json({ ok: true }, 200, cors);
}

// ── Player lookup ─────────────────────────────────────────────────────────────

async function handlePlayerLookup(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const { email } = body;
  if (!email || !isValidEmail(email)) return err('Valid email is required', 400, cors);

  const normalized = normalizeEmail(email);
  const playerIds = await env.CTT_KV.get(`email-index:${normalized}`, { type: 'json' });

  if (!playerIds || playerIds.length === 0) return json({ found: false }, 404, cors);

  const players = await Promise.all(
    playerIds.map(id => env.CTT_KV.get(`player:${id}`, { type: 'json' }))
  );

  const validPlayers = players
    .filter(Boolean)
    .map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, active: p.active !== false }));

  if (validPlayers.length === 0) return json({ found: false }, 404, cors);

  return json({ found: true, players: validPlayers }, 200, cors);
}

// ── Player registration ───────────────────────────────────────────────────────

async function handlePlayerCreate(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const { firstName, lastName, email, phone, ntrpLevel, improvementGoals, parentEmail } = body;

  if (!firstName || !lastName || !email || !phone) {
    return err('All fields are required', 400, cors);
  }
  if (!isValidEmail(email)) return err('Valid email is required', 400, cors);

  const normalized = normalizeEmail(email);
  const existing = await env.CTT_KV.get(`email-index:${normalized}`, { type: 'json' });

  if (existing && existing.length > 0) {
    const existingPlayers = await Promise.all(
      existing.map(id => env.CTT_KV.get(`player:${id}`, { type: 'json' }))
    );
    const hasActive = existingPlayers.some(p => isActive(p));
    if (hasActive) {
      return err('A profile already exists for this email. Please use the lookup form.', 409, cors);
    } else {
      return json(
        { error: 'You already have an account that\'s marked as Inactive. Contact your coach to resume.', code: 'INACTIVE' },
        409,
        cors
      );
    }
  }

  const playerId = generateId();
  const now = new Date().toISOString();

  const player = {
    id: playerId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalized,
    phone: phone.trim(),
    ntrpLevel: ntrpLevel || '',
    improvementGoals: improvementGoals || '',
    parentEmail: parentEmail ? normalizeEmail(parentEmail) : '',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await env.CTT_KV.put(`player:${playerId}`, JSON.stringify(player));
  await env.CTT_KV.put(`email-index:${normalized}`, JSON.stringify([playerId]));

  if (parentEmail && normalizeEmail(parentEmail) !== normalized) {
    const pNorm = normalizeEmail(parentEmail);
    const parentIds = (await env.CTT_KV.get(`email-index:${pNorm}`, { type: 'json' })) || [];
    if (!parentIds.includes(playerId)) {
      parentIds.push(playerId);
      await env.CTT_KV.put(`email-index:${pNorm}`, JSON.stringify(parentIds));
    }
  }

  const allIds = (await env.CTT_KV.get('players:all', { type: 'json' })) || [];
  allIds.push(playerId);
  await env.CTT_KV.put('players:all', JSON.stringify(allIds));

  return json({ id: playerId, player }, 201, cors);
}

// ── Player GET ────────────────────────────────────────────────────────────────

async function handlePlayerGet(request, env, playerId, cors) {
  const ownerSession = await validateOwnerSession(request, env);
  const playerIdHeader = request.headers.get('X-Player-Id');

  if (!ownerSession) {
    if (!playerIdHeader || playerIdHeader !== playerId) {
      return err('Authentication required', 401, cors);
    }
  }

  const player = await env.CTT_KV.get(`player:${playerId}`, { type: 'json' });
  if (!player) return err('Player not found', 404, cors);

  // Backfill active field for old records
  if (player.active === undefined) player.active = true;

  return json(player, 200, cors);
}

// ── Player PUT ────────────────────────────────────────────────────────────────

async function handlePlayerUpdate(request, env, playerId, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const existing = await env.CTT_KV.get(`player:${playerId}`, { type: 'json' });
  if (!existing) return err('Player not found', 404, cors);

  const oldEmail = existing.email;
  const newEmail = body.email ? normalizeEmail(body.email) : oldEmail;

  const updated = {
    ...existing,
    firstName: body.firstName?.trim() || existing.firstName,
    lastName: body.lastName?.trim() || existing.lastName,
    email: newEmail,
    phone: body.phone?.trim() || existing.phone,
    ntrpLevel: body.ntrpLevel !== undefined ? body.ntrpLevel : existing.ntrpLevel,
    improvementGoals: body.improvementGoals !== undefined ? body.improvementGoals : existing.improvementGoals,
    parentEmail: body.parentEmail !== undefined ? normalizeEmail(body.parentEmail) : existing.parentEmail,
    active: body.active !== undefined ? Boolean(body.active) : (existing.active !== false),
    updatedAt: new Date().toISOString(),
  };

  await env.CTT_KV.put(`player:${playerId}`, JSON.stringify(updated));

  if (newEmail !== oldEmail) {
    const oldIds = (await env.CTT_KV.get(`email-index:${oldEmail}`, { type: 'json' })) || [];
    const filtered = oldIds.filter(id => id !== playerId);
    if (filtered.length === 0) {
      await env.CTT_KV.delete(`email-index:${oldEmail}`);
    } else {
      await env.CTT_KV.put(`email-index:${oldEmail}`, JSON.stringify(filtered));
    }
    const newIds = (await env.CTT_KV.get(`email-index:${newEmail}`, { type: 'json' })) || [];
    if (!newIds.includes(playerId)) newIds.push(playerId);
    await env.CTT_KV.put(`email-index:${newEmail}`, JSON.stringify(newIds));
  }

  return json(updated, 200, cors);
}

// ── Delete player ─────────────────────────────────────────────────────────────

async function handlePlayerDelete(request, env, playerId, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  const player = await env.CTT_KV.get(`player:${playerId}`, { type: 'json' });
  if (!player) return err('Player not found', 404, cors);

  // Remove from players:all
  const allIds = (await env.CTT_KV.get('players:all', { type: 'json' })) || [];
  const filteredAll = allIds.filter(id => id !== playerId);
  await env.CTT_KV.put('players:all', JSON.stringify(filteredAll));

  // Remove from email-index (player's own email)
  const normalized = normalizeEmail(player.email);
  const emailIds = (await env.CTT_KV.get(`email-index:${normalized}`, { type: 'json' })) || [];
  const filteredEmail = emailIds.filter(id => id !== playerId);
  if (filteredEmail.length === 0) {
    await env.CTT_KV.delete(`email-index:${normalized}`);
  } else {
    await env.CTT_KV.put(`email-index:${normalized}`, JSON.stringify(filteredEmail));
  }

  // Remove from email-index (parent email, if different)
  if (player.parentEmail && player.parentEmail !== normalized) {
    const parentIds = (await env.CTT_KV.get(`email-index:${player.parentEmail}`, { type: 'json' })) || [];
    const filteredParent = parentIds.filter(id => id !== playerId);
    if (filteredParent.length === 0) {
      await env.CTT_KV.delete(`email-index:${player.parentEmail}`);
    } else {
      await env.CTT_KV.put(`email-index:${player.parentEmail}`, JSON.stringify(filteredParent));
    }
  }

  // Delete all sessions
  const sessionIds = (await env.CTT_KV.get(`sessions:list:${playerId}`, { type: 'json' })) || [];
  await Promise.all(sessionIds.map(sid => env.CTT_KV.delete(`session:${sid}`)));
  await env.CTT_KV.delete(`sessions:list:${playerId}`);

  // Delete LTTDP
  await env.CTT_KV.delete(`lttdp:${playerId}`);

  // Delete player record
  await env.CTT_KV.delete(`player:${playerId}`);

  return json({ ok: true }, 200, cors);
}

// ── All players ───────────────────────────────────────────────────────────────

async function handlePlayersAll(request, env, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get('include_inactive') === 'true';

  const allIds = (await env.CTT_KV.get('players:all', { type: 'json' })) || [];
  const players = await Promise.all(allIds.map(id => env.CTT_KV.get(`player:${id}`, { type: 'json' })));

  const valid = players
    .filter(Boolean)
    .map(p => ({ ...p, active: p.active !== false }))
    .filter(p => includeInactive || p.active)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return json({ players: valid }, 200, cors);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function handleAnalytics(request, env, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  const allIds = (await env.CTT_KV.get('players:all', { type: 'json' })) || [];
  const players = await Promise.all(allIds.map(id => env.CTT_KV.get(`player:${id}`, { type: 'json' })));
  const validPlayers = players.filter(Boolean).map(p => ({ ...p, active: p.active !== false }));

  const activePlayers = validPlayers.filter(p => p.active);
  const inactiveCount = validPlayers.length - activePlayers.length;

  const ntrpDistribution = {};
  for (const p of activePlayers) {
    const level = p.ntrpLevel || 'Not set';
    ntrpDistribution[level] = (ntrpDistribution[level] || 0) + 1;
  }

  // Count unique sessions, deduplicating group sessions by groupSessionId
  const sessionLists = await Promise.all(allIds.map(id => env.CTT_KV.get(`sessions:list:${id}`, { type: 'json' })));
  const allSessionIds = sessionLists.flatMap(list => list || []);

  const allSessions = await Promise.all(allSessionIds.map(id => env.CTT_KV.get(`session:${id}`, { type: 'json' })));

  const seenGroupIds = new Set();
  let totalUniqueSessions = 0;
  for (const s of allSessions.filter(Boolean)) {
    if (s.isGroup && s.groupSessionId) {
      if (!seenGroupIds.has(s.groupSessionId)) {
        seenGroupIds.add(s.groupSessionId);
        totalUniqueSessions++;
      }
    } else {
      totalUniqueSessions++;
    }
  }

  return json({
    totalActivePlayers: activePlayers.length,
    totalInactivePlayers: inactiveCount,
    ntrpDistribution,
    totalUniqueSessions,
  }, 200, cors);
}

// ── LTTDP ─────────────────────────────────────────────────────────────────────

async function handleLttdpGet(request, env, playerId, cors) {
  const ownerSession = await validateOwnerSession(request, env);
  const playerIdHeader = request.headers.get('X-Player-Id');

  if (!ownerSession) {
    if (!playerIdHeader || playerIdHeader !== playerId) {
      return err('Authentication required', 401, cors);
    }
  }

  const lttdp = await env.CTT_KV.get(`lttdp:${playerId}`, { type: 'json' });
  return json(lttdp || {
    playerId,
    goals: '',
    technicalSkills: '',
    patternsAndPlays: '',
    onOffSeasons: '',
    updatedAt: null,
  }, 200, cors);
}

async function handleLttdpPut(request, env, playerId, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const lttdp = {
    playerId,
    goals: body.goals || '',
    technicalSkills: body.technicalSkills || '',
    patternsAndPlays: body.patternsAndPlays || '',
    onOffSeasons: body.onOffSeasons || '',
    updatedAt: new Date().toISOString(),
  };

  await env.CTT_KV.put(`lttdp:${playerId}`, JSON.stringify(lttdp));
  return json(lttdp, 200, cors);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

async function handleSessionsList(request, env, playerId, cors) {
  const ownerSession = await validateOwnerSession(request, env);
  const playerIdHeader = request.headers.get('X-Player-Id');

  if (!ownerSession) {
    if (!playerIdHeader || playerIdHeader !== playerId) {
      return err('Authentication required', 401, cors);
    }
  }

  const sessionIds = (await env.CTT_KV.get(`sessions:list:${playerId}`, { type: 'json' })) || [];
  if (sessionIds.length === 0) return json({ sessions: [] }, 200, cors);

  const sessions = await Promise.all(
    sessionIds.map(id => env.CTT_KV.get(`session:${id}`, { type: 'json' }))
  );

  return json({ sessions: sessions.filter(Boolean) }, 200, cors);
}

async function handleSessionLatest(request, env, playerId, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  const sessionIds = (await env.CTT_KV.get(`sessions:list:${playerId}`, { type: 'json' })) || [];
  if (sessionIds.length === 0) return json({ session: null }, 200, cors);

  const latest = await env.CTT_KV.get(`session:${sessionIds[0]}`, { type: 'json' });
  return json({ session: latest }, 200, cors);
}

async function handleSessionCreate(request, env, cors) {
  const ownerSession = await validateOwnerSession(request, env);
  if (!ownerSession) return err('Authentication required', 401, cors);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const { date, durationMinutes, topicsCovered } = body;

  // Group session
  if (body.isGroup) {
    const { playerIds, sharedNotes, individualNotes = {} } = body;

    if (!Array.isArray(playerIds) || playerIds.length < 2 || !date || !durationMinutes || !topicsCovered || !sharedNotes) {
      return err('All fields are required for group sessions (minimum 2 players)', 400, cors);
    }

    const playerChecks = await Promise.all(playerIds.map(id => env.CTT_KV.get(`player:${id}`, { type: 'json' })));
    if (playerChecks.some(p => !p)) return err('One or more players not found', 404, cors);

    const groupSessionId = generateId();
    const now = new Date().toISOString();
    const groupSize = playerIds.length;

    // Pre-generate all session IDs so we can cross-link them
    const entries = playerIds.map(pid => ({ playerId: pid, sessionId: generateId() }));
    const allSessionIds = entries.map(e => e.sessionId);

    for (const { playerId: pid, sessionId } of entries) {
      const newSession = {
        id: sessionId,
        playerId: pid,
        date,
        durationMinutes: Number(durationMinutes),
        topicsCovered,
        isGroup: true,
        groupSessionId,
        groupSize,
        groupMemberSessionIds: allSessionIds,
        sharedNotes,
        individualNotes: individualNotes[pid] || '',
        createdAt: now,
        updatedAt: now,
      };

      await env.CTT_KV.put(`session:${sessionId}`, JSON.stringify(newSession));

      const list = (await env.CTT_KV.get(`sessions:list:${pid}`, { type: 'json' })) || [];
      list.unshift(sessionId);
      await env.CTT_KV.put(`sessions:list:${pid}`, JSON.stringify(list));
    }

    return json({ groupSessionId, sessions: entries }, 201, cors);
  }

  // Individual session
  const { playerId, notes } = body;
  if (!playerId || !date || !durationMinutes || !topicsCovered || !notes) {
    return err('All fields are required', 400, cors);
  }

  const playerExists = await env.CTT_KV.get(`player:${playerId}`, { type: 'json' });
  if (!playerExists) return err('Player not found', 404, cors);

  const sessionId = generateId();
  const now = new Date().toISOString();

  const newSession = {
    id: sessionId,
    playerId,
    date,
    durationMinutes: Number(durationMinutes),
    topicsCovered,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  await env.CTT_KV.put(`session:${sessionId}`, JSON.stringify(newSession));

  const sessionIds = (await env.CTT_KV.get(`sessions:list:${playerId}`, { type: 'json' })) || [];
  sessionIds.unshift(sessionId);
  await env.CTT_KV.put(`sessions:list:${playerId}`, JSON.stringify(sessionIds));

  return json(newSession, 201, cors);
}

async function handleSessionUpdate(request, env, sessionId, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const existing = await env.CTT_KV.get(`session:${sessionId}`, { type: 'json' });
  if (!existing) return err('Session not found', 404, cors);

  const updated = {
    ...existing,
    date: body.date !== undefined ? body.date : existing.date,
    durationMinutes: body.durationMinutes !== undefined ? Number(body.durationMinutes) : existing.durationMinutes,
    topicsCovered: body.topicsCovered !== undefined ? body.topicsCovered : existing.topicsCovered,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    sharedNotes: body.sharedNotes !== undefined ? body.sharedNotes : existing.sharedNotes,
    individualNotes: body.individualNotes !== undefined ? body.individualNotes : existing.individualNotes,
    updatedAt: new Date().toISOString(),
  };

  await env.CTT_KV.put(`session:${sessionId}`, JSON.stringify(updated));

  // Propagate sharedNotes edits to all other group members
  if (existing.isGroup && body.sharedNotes !== undefined) {
    const memberIds = (existing.groupMemberSessionIds || []).filter(id => id !== sessionId);
    await Promise.all(memberIds.map(async (memberId) => {
      const memberSession = await env.CTT_KV.get(`session:${memberId}`, { type: 'json' });
      if (memberSession) {
        memberSession.sharedNotes = body.sharedNotes;
        memberSession.updatedAt = updated.updatedAt;
        await env.CTT_KV.put(`session:${memberId}`, JSON.stringify(memberSession));
      }
    }));
  }

  return json(updated, 200, cors);
}

// ── Resources ─────────────────────────────────────────────────────────────────

async function handleResourcesGet(request, env, cors) {
  const data = (await env.CTT_KV.get('content:resources', { type: 'json' })) || { discountCodes: '', links: [] };
  return json(data, 200, cors);
}

async function handleResourcesPut(request, env, cors) {
  const session = await validateOwnerSession(request, env);
  if (!session) return err('Authentication required', 401, cors);

  let body;
  try { body = await request.json(); } catch { return err('Invalid request body', 400, cors); }

  const discountCodes = typeof body.discountCodes === 'string' ? body.discountCodes : '';
  const links = Array.isArray(body.links)
    ? body.links
        .filter(l => l && typeof l.label === 'string' && typeof l.url === 'string')
        .map(l => ({ label: l.label.trim(), url: l.url.trim(), description: typeof l.description === 'string' ? l.description.trim() : '' }))
        .filter(l => l.label || l.url)
    : [];

  const updated = { discountCodes, links, updatedAt: new Date().toISOString() };
  await env.CTT_KV.put('content:resources', JSON.stringify(updated));
  return json(updated, 200, cors);
}

// ── Guest ─────────────────────────────────────────────────────────────────────

function handleGuestInfo(cors) {
  return json({
    name: 'Cooper Anderson',
    title: 'Tennis Coach — Cooper Teaches Tennis',
    bio: 'Cooper Anderson is a tennis coach focused on player development at every level. His approach combines technical skill building with long-term development planning tailored to each player.',
    approach: [
      'Individual skill assessments to identify strengths and growth areas',
      'Long-Term Tennis Development Plans co-built with each player',
      'Session notes shared with players after every lesson',
      'Focus on both on-court performance and off-season development',
    ],
    contact: 'Reach out through Instagram or TikTok @CooperTeachesTennis',
  }, 200, cors);
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };
    const cors = getCorsHeaders(request);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } });
    }

    try {
      // Auth
      if (method === 'GET' && pathname === '/api/auth/github') return handleAuthGithub(request, env);
      if (method === 'GET' && pathname === '/api/auth/callback') return handleAuthCallback(request, env);
      if (method === 'GET' && pathname === '/api/auth/check') return handleAuthCheck(request, env, cors);
      if (method === 'POST' && pathname === '/api/auth/logout') return handleAuthLogout(request, env, cors);

      // Players
      if (method === 'POST' && pathname === '/api/player/lookup') return handlePlayerLookup(request, env, cors);
      if (method === 'POST' && pathname === '/api/player') return handlePlayerCreate(request, env, cors);
      if (method === 'GET' && pathname === '/api/players') return handlePlayersAll(request, env, cors);
      if (method === 'GET' && pathname === '/api/analytics') return handleAnalytics(request, env, cors);

      const playerMatch = pathname.match(/^\/api\/player\/([^/]+)$/);
      if (playerMatch) {
        if (method === 'GET') return handlePlayerGet(request, env, playerMatch[1], cors);
        if (method === 'PUT') return handlePlayerUpdate(request, env, playerMatch[1], cors);
        if (method === 'DELETE') return handlePlayerDelete(request, env, playerMatch[1], cors);
      }

      // LTTDP
      const lttdpMatch = pathname.match(/^\/api\/lttdp\/([^/]+)$/);
      if (lttdpMatch) {
        if (method === 'GET') return handleLttdpGet(request, env, lttdpMatch[1], cors);
        if (method === 'PUT') return handleLttdpPut(request, env, lttdpMatch[1], cors);
      }

      // Sessions
      const sessionsLatestMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/latest$/);
      if (sessionsLatestMatch && method === 'GET') return handleSessionLatest(request, env, sessionsLatestMatch[1], cors);

      const sessionsListMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionsListMatch && method === 'GET') return handleSessionsList(request, env, sessionsListMatch[1], cors);

      if (method === 'POST' && pathname === '/api/session') return handleSessionCreate(request, env, cors);

      const sessionUpdateMatch = pathname.match(/^\/api\/session\/([^/]+)$/);
      if (sessionUpdateMatch && method === 'PUT') return handleSessionUpdate(request, env, sessionUpdateMatch[1], cors);

      // Resources
      if (method === 'GET' && pathname === '/api/resources') return handleResourcesGet(request, env, cors);
      if (method === 'PUT' && pathname === '/api/resources') return handleResourcesPut(request, env, cors);

      // Guest
      if (method === 'GET' && pathname === '/api/guest/info') return handleGuestInfo(cors);

      return err('Not found', 404, cors);
    } catch (e) {
      return err('Internal server error', 500, cors);
    }
  },
};
