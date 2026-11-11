export let isFetchingReports = false;

export async function fetchReportsData(ctx) {
  const { auth, state: S, render } = ctx;
  if (isFetchingReports) return;
  isFetchingReports = true;
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) {
      isFetchingReports = false;
      return;
    }

    const { from, to, dept } = S.ui.rp;
    const qParams = new URLSearchParams();
    if (from) qParams.set('from', from);
    if (to) qParams.set('to', to);
    if (dept) qParams.set('department', dept);

    const qs = qParams.toString() ? `?${qParams.toString()}` : '';
    const deptQs = dept ? `?department=${encodeURIComponent(dept)}` : '';
    const headers = { Authorization: `Bearer ${token}` };

    const [ovRes, dpRes, trRes, asRes] = await Promise.all([
      fetch(`/api/reports/overview${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/reports/departments${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/reports/trends${qs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/reports/assets${deptQs}`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    S.rpData = {
      overview: ovRes,
      departments: dpRes,
      trends: trRes,
      assets: asRes,
      loaded: true,
    };
  } catch (err) {
    console.warn('Reports fetch error:', err.message);
  } finally {
    isFetchingReports = false;
    render(true);
  }
}

export async function syncMaintenanceRequests(ctx) {
  const { auth, state: S, persist, render } = ctx;
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch('/api/maintenance-requests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.requests)) {
        // MongoDB is the sole source of truth for persisted requests
        S.requests = data.requests;
        persist();
        render(true);
      }
    }
  } catch (e) {
    console.warn('MongoDB sync notice:', e.message);
  }
}

export async function syncAssets(ctx) {
  const { auth, state: S, persist, render, constants } = ctx;
  const TODAY = constants?.TODAY || '';
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch('/api/assets?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.assets) && data.assets.length > 0) {
        S.assets = data.assets.map((a) => ({
          ...a,
          id: a.id || a.assetId || a._id,
          assetId: a.assetId || a.id || a._id,
          type: a.type || a.category || a.assetType || 'Track',
          last: a.last || a.lastInspectionDate || TODAY,
        }));
        persist();
        render(true);
      }
    }
  } catch (e) {
    console.warn('Asset sync notice:', e.message);
  }
}

export async function syncNotifications(ctx) {
  const { auth, state: S, persist, render, helpers } = ctx;
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.notifications)) {
        S.notifs = data.notifications;
        persist();
        if (helpers?.updateBell) helpers.updateBell();
        if (helpers?.getCurrentRoute && helpers.getCurrentRoute() === 'notifications') {
          render(true);
        }
      }
    }
  } catch (e) {
    console.warn('Notifications sync notice:', e.message);
  }
}

export async function updateRequestStatusApi(auth, id, payload) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      const res = await fetch(`/api/maintenance-requests/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return res;
    }
  } catch (err) {
    console.warn('Backend update request status notice:', err.message);
    throw err;
  }
}

export async function deleteAssetApi(auth, id) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      const res = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res;
    }
  } catch (err) {
    console.warn('Backend delete asset notice:', err.message);
  }
}

export async function deleteRequestApi(auth, id) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      const res = await fetch(`/api/maintenance-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res;
    }
  } catch (err) {
    console.warn('Backend delete request notice:', err.message);
  }
}

export async function createRequestApi(auth, payload) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required. Please log in.');

  const res = await fetch('/api/maintenance-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return res;
}

export async function createAssetApi(auth, payload) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return res;
    }
  } catch (err) {
    console.warn('Backend asset creation notice:', err.message);
  }
}

export async function markAllNotificationsReadApi(auth) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.warn('Backend mark-all-read notice:', err.message);
  }
}

export async function markNotificationReadApi(auth, id) {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (token) {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.warn('Backend notification mark-read notice:', err.message);
  }
}
