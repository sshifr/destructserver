import React, { Suspense, lazy } from "react";
import "./App.css";
import Background from "./components/animation";

const MediaUpload = lazy(() => import("./components/MediaUpload"));
const Audio = lazy(() => import("./components/audio"));
const Camera = lazy(() => import("./components/camera"));
const IPCamera = lazy(() => import("./components/IPCamera"));

function App() {
  return (
    <div className="App">
      <Background />
      <Suspense fallback={<div className="section-loading">Загрузка…</div>}>
        <MediaUpload />
        <Audio />
        <Camera />
        <IPCamera />
      </Suspense>
    </div>
  );
}

export default App;