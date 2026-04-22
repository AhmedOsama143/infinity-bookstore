import { getSiteSettings } from '@/lib/data';

export default async function AnnouncementBar() {
  const settings = await getSiteSettings();
  if (!settings?.announcement_bar_enabled || !settings?.announcement_bar_text_ar) return null;
  return (
    <div className="bg-primary-dark text-white text-center text-sm py-2 font-body px-4">
      {settings.announcement_bar_text_ar}
    </div>
  );
}
