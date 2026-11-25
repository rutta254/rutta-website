import { FaShirt } from 'react-icons/fa6';
import { OFFERINGS } from './cloudmoreData';

export default function AboutCard() {
  const about = OFFERINGS.find((item) => item.type === 'about');
  if (!about) return null;

  return (
    <div
      id={about.id}
      className="lg:col-span-5 scroll-mt-24 rounded-2xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 space-y-4 shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${about.badgeBg}`}
        >
          {about.badge}
        </span>
        <div
          className={`w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center ${about.accent}`}
        >
          <FaShirt className="text-base" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-white">{about.title}</h2>
      <p className="text-sm text-slate-400 leading-relaxed">{about.description}</p>
    </div>
  );
}