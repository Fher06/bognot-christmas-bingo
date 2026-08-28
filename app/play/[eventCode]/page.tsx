import PlayClient from "./PlayClient";

export default function PlayPage({ params }: { params: { eventCode: string } }) {
  return <PlayClient eventCode={params.eventCode} />;
}
