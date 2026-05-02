'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const SOUND_KEY = 'admin-notif-sound';
const PERMISSION_KEY = 'admin-notif-browser';

function playChime() {
  if (typeof window === 'undefined') return;
  const muted = window.localStorage.getItem(SOUND_KEY) === 'off';
  if (muted) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked (no user gesture yet) — ignore.
  }
}

function showBrowserNotification(title: string, body: string | null) {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(PERMISSION_KEY) !== 'on') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body: body ?? undefined,
      icon: '/favicon.ico',
      tag: 'admin-notif',
    });
  } catch {
    // Some browsers throw inside an inactive tab — ignore.
  }
}

interface Notif {
  id: string;
  type: string;
  title_ar: string;
  body_ar: string | null;
  is_read: boolean;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
}

const ICON: Record<string, string> = {
  new_order: 'fa-bag-shopping text-primary',
  reserved: 'fa-bookmark text-accent-dark',
  picked_up: 'fa-circle-check text-success',
  paid: 'fa-money-bill text-success',
  cod_collected: 'fa-coins text-success',
  low_stock: 'fa-triangle-exclamation text-accent-dark',
  cap_hit: 'fa-ban text-danger',
  new_student: 'fa-user-plus text-primary',
  return_request: 'fa-rotate-left text-accent-dark',
  order_cancelled: 'fa-ban text-danger',
};

export default function NotificationBell({
  initial,
  branchFilter,
}: {
  initial: Notif[];
  branchFilter?: string | null;
}) {
  const [items, setItems] = useState<Notif[]>(initial);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [browserOn, setBrowserOn] = useState(false);

  useEffect(() => {
    setSoundOn(window.localStorage.getItem(SOUND_KEY) !== 'off');
    setBrowserOn(window.localStorage.getItem(PERMISSION_KEY) === 'on');
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    if (next) playChime(); // preview
  }

  async function toggleBrowser() {
    if (browserOn) {
      window.localStorage.setItem(PERMISSION_KEY, 'off');
      setBrowserOn(false);
      return;
    }
    if (!('Notification' in window)) {
      alert('متصفحك لا يدعم الإشعارات');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    window.localStorage.setItem(PERMISSION_KEY, 'on');
    setBrowserOn(true);
    new Notification('إشعارات مفعّلة', {
      body: 'ستصلك تنبيهات بالطلبات الجديدة وحالات المخزون',
    });
  }

  useEffect(() => {
    const supa = createClient();
    let channel = supa
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: branchFilter
            ? `branch_id=eq.${branchFilter}`
            : 'audience=eq.admin',
        },
        (payload) => {
          const fresh = payload.new as Notif;
          setItems((prev) => [fresh, ...prev].slice(0, 30));
          playChime();
          showBrowserNotification(fresh.title_ar, fresh.body_ar);
        }
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [branchFilter]);

  const unread = items.filter((i) => !i.is_read).length;

  function linkFor(n: Notif): string {
    if (n.entity_type === 'order') return `/admin/orders/${n.entity_id}`;
    if (n.entity_type === 'return') return `/admin/returns`;
    return '/admin/notifications';
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="الإشعارات"
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 rounded-full bg-bg-light hover:bg-primary-light text-primary-dark flex items-center justify-center transition-colors"
      >
        <i className="fa-solid fa-bell text-lg" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 bg-accent text-white text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-transparent"
          />
          <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-[360px] max-h-[480px] overflow-y-auto card shadow-card-lg z-40">
            <div className="p-4 border-b border-bg-light sticky top-0 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-primary-dark">الإشعارات</h3>
                <Link
                  href="/admin/notifications"
                  onClick={() => setOpen(false)}
                  className="text-primary text-xs font-bold hover:text-primary-dark"
                >
                  عرض الكل
                </Link>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-pill ${soundOn ? 'bg-primary-light text-primary-dark' : 'bg-bg-light text-[#666]'}`}
                  title={soundOn ? 'إيقاف الصوت' : 'تفعيل الصوت'}
                >
                  <i className={`fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark'}`} />
                  {soundOn ? 'الصوت مفعّل' : 'الصوت موقوف'}
                </button>
                <button
                  type="button"
                  onClick={toggleBrowser}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-pill ${browserOn ? 'bg-primary-light text-primary-dark' : 'bg-bg-light text-[#666]'}`}
                  title="إشعارات سطح المكتب"
                >
                  <i className={`fa-solid ${browserOn ? 'fa-bell' : 'fa-bell-slash'}`} />
                  {browserOn ? 'إشعارات المتصفح' : 'تفعيل إشعارات المتصفح'}
                </button>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#666]">
                <i className="fa-regular fa-bell-slash text-2xl text-primary-light block mb-2" />
                لا توجد إشعارات
              </div>
            ) : (
              <ul className="divide-y divide-bg-light">
                {items.slice(0, 10).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={linkFor(n)}
                      onClick={() => setOpen(false)}
                      className={`block p-3 hover:bg-bg-light transition-colors ${!n.is_read ? 'bg-primary-light/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <i className={`fa-solid ${ICON[n.type] ?? 'fa-bell text-primary'} mt-1`} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold truncate">{n.title_ar}</h4>
                          {n.body_ar && (
                            <p className="text-xs text-[#666] line-clamp-2 mt-0.5">{n.body_ar}</p>
                          )}
                          <p className="text-[10px] text-[#999] mt-1">
                            {new Date(n.created_at).toLocaleString('ar-EG', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
