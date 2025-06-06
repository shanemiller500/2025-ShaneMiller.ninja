import Results from "./Results";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Results />
    </Suspense>
  );
}
