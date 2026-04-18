const skeletonRows = ["hero", "stats", "courses", "chat"];

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement de PMU Gagnant"
      className="min-h-screen bg-[#0A0E1A] px-4 py-6 text-[#F6F2E8]"
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-[#D4AF37]/25" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-[#00C851]/20" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="grid gap-5">
            <div className="grid min-h-[22rem] overflow-hidden rounded-lg border border-[#D4AF37]/20 bg-[#101827] shadow-2xl shadow-black/25 lg:grid-cols-[0.9fr_1fr]">
              <div className="min-h-[16rem] animate-pulse bg-white/[0.06]" />
              <div className="grid content-center gap-4 p-5 md:p-8">
                <div className="h-3 w-28 animate-pulse rounded bg-[#D4AF37]/30" />
                <div className="h-14 w-4/5 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                <div className="grid gap-3 sm:grid-cols-3">
                  {skeletonRows.slice(0, 3).map((item) => (
                    <div
                      className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
                      key={item}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {skeletonRows.concat(["extra-1", "extra-2"]).map((item) => (
                <div
                  className="h-40 animate-pulse rounded-lg border border-[#D4AF37]/15 bg-[#101827]"
                  key={item}
                />
              ))}
            </div>
          </div>

          <aside className="hidden content-start gap-3 lg:grid">
            {skeletonRows.slice(0, 3).map((item) => (
              <div
                className="h-36 animate-pulse rounded-lg border border-[#D4AF37]/20 bg-[#101827]"
                key={item}
              />
            ))}
          </aside>
        </div>
      </section>
    </main>
  );
}
