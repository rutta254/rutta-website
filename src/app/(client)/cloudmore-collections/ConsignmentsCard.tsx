import { FaTags } from 'react-icons/fa6';
import { OFFERINGS } from './cloudmoreData';

export default function ConsignmentsCard() {
  const consignments = OFFERINGS.find((item) => item.type === 'consignments');
  if (!consignments) return null;

  return (
    <div
      id={consignments.id}
      className="lg:col-span-7 scroll-mt-24 rounded-2xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 space-y-5 shadow-xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${consignments.badgeBg}`}
          >
            {consignments.badge}
          </span>
          <div
            className={`w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center ${consignments.accent}`}
          >
            <FaTags className="text-base" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white">{consignments.title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{consignments.description}</p>
      </div>

      {consignments.highlights.length > 0 && (
        <ul className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
          {consignments.highlights.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}