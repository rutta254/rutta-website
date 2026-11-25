import { FaShirt, FaTags } from 'react-icons/fa6';
import { OFFERINGS } from '../cloudmore-collections/cloudmoreData';

export default function OfferingsGrid() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {OFFERINGS.map((item) => {
        const Icon = item.type === 'about' ? FaShirt : FaTags;
        return (
          <div
            key={item.id}
            id={item.id}
            className="scroll-mt-24 rounded-2xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${item.badgeBg}`}
                >
                  {item.badge}
                </span>
                <div
                  className={`w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center ${item.accent}`}
                >
                  <Icon className="text-base" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-white">{item.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            </div>

            {item.highlights.length > 0 && (
              <ul className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300">
                {item.highlights.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}