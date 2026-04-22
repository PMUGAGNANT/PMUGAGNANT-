import Image from "next/image";

export default function Loading() {
  return (
    <div className="route-loading-screen" role="status" aria-live="polite">
      <div className="boot-loader">
        <div className="boot-loader__mark" aria-hidden="true">
          <span className="boot-loader__orbit" />
          <Image src="/logo-turfedge.png" alt="" width={56} height={56} priority />
        </div>
        <div className="boot-loader__copy">
          <span>TurfEdge</span>
          <strong>Chargement des donnees</strong>
        </div>
        <div className="boot-loader__scan" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Cotes live / VMAX / bankroll</p>
      </div>
    </div>
  );
}
