import AboutCard from './AboutCard';
import ConsignmentsCard from './ConsignmentsCard';

export default function OfferingsGrid() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 items-start gap-6">
      <AboutCard />
      <ConsignmentsCard />
    </section>
  );
}