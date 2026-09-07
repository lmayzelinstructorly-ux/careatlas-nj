import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PurposeDialog } from "./components/PurposeDialog";

const InternalDataReviewPage = import.meta.env.DEV
  ? lazy(() => import("./pages/InternalDataReviewPage"))
  : null;
const MapPage = lazy(() => import("./pages/MapPage"));
const ProjectStoryPage = lazy(() => import("./pages/ProjectStoryPage"));

function RouteLoadingState() {
  return (
    <main className="min-h-screen bg-[#f7f9f9] px-5 py-12 text-hb-text sm:px-8">
      <p className="mx-auto max-w-[88rem] text-sm font-medium text-hb-muted">
        Loading CareAtlas NJ...
      </p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <PurposeDialog />
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route element={<MapPage />} path="/" />
          <Route element={<ProjectStoryPage />} path="/story" />
          {InternalDataReviewPage ? (
            <Route element={<InternalDataReviewPage />} path="/internal-data" />
          ) : null}
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
