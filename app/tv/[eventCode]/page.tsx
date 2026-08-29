import TVClient from "./TVClient";

export default function TVPage({ params }: { params: { eventCode: string } }) {
  return <TVClient eventCode={params.eventCode} />;
}
