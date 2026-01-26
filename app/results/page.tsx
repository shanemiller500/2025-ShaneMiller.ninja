import { Suspense } from "react";

import Results from "./Results";

/* ------------------------------------------------------------------ */
/*  ResultsPage Component                                              */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <Results />
    </Suspense>
  );
}
