import Image from "next/image";

type TurfEdgeWaitScreenProps = {
  label?: string;
  mode?: "boot" | "route";
};

export function TurfEdgeWaitScreen({
  label = "Analyse en cours",
  mode = "route",
}: TurfEdgeWaitScreenProps) {
  return (
    <div
      className={`turfedge-wait-screen turfedge-wait-screen--${mode}`}
      role="status"
      aria-live="polite"
    >
      <Image
        className="turfedge-wait-screen__image"
        src="/turfedge-waiting-poster.png"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="turfedge-wait-screen__veil" aria-hidden="true" />
      <div className="turfedge-wait-screen__grain" aria-hidden="true" />

      <section className="turfedge-wait-screen__content" aria-label={label}>
        <div className="turfedge-wait-screen__brand">
          <Image src="/logo-turfedge.png" alt="" width={62} height={62} priority />
          <div>
            <span>TurfEdge</span>
            <small>L&apos;intelligence du terrain</small>
          </div>
        </div>

        <p className="turfedge-wait-screen__eyebrow">{label}</p>
        <h1>
          <em>TurfEdge</em>, vous avez choisi la bonne.
        </h1>
        <p className="turfedge-wait-screen__text">
          Donnees precises. Analyses pointues. Decisions gagnantes.
        </p>

        <div className="turfedge-wait-screen__progress" aria-hidden="true">
          <span />
        </div>

        <div className="turfedge-wait-screen__signals" aria-hidden="true">
          <span>VMAX</span>
          <span>Cotes live</span>
          <span>Bankroll</span>
        </div>
      </section>
    </div>
  );
}
