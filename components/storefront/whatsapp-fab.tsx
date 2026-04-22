import { getSiteSettings } from '@/lib/data';

export default async function WhatsappFab() {
  const settings = await getSiteSettings();
  const wa = settings?.support_whatsapp ?? '201104605272';
  return (
    <a
      href={`https://wa.me/${wa}?text=${encodeURIComponent('مرحباً، أحتاج مساعدة في طلب من مكتبة إنفينيتي')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل واتساب"
      className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-card-lg hover:scale-110 transition-transform"
    >
      <i className="fa-brands fa-whatsapp text-2xl" />
    </a>
  );
}
