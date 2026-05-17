'use client';

import { useEffect } from 'react';
import { trackViewItem, type ItemSource } from '@/lib/analytics/gtm';

// Client island dropped into the PDP (a server component) so we can fire the
// GA4 `view_item` event on every product view without making the whole page
// client-rendered.

export default function TrackViewItem({ item }: { item: ItemSource }) {
  useEffect(() => {
    trackViewItem(item);
  }, [item]);
  return null;
}
