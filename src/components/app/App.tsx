import React, { useCallback, useEffect, useRef, useState } from "react";
import GlobalError from "components/error/GlobalError";
import AppToolbar from "./AppToolbar";
import BackgroundsPage from "components/pages/BackgroundsPage";
import SpritesPage from "components/pages/SpritesPage";
import DialoguePage from "components/pages/DialoguePage";
import WorldPage from "components/pages/WorldPage";
import MusicPage from "components/pages/MusicPage";
import SettingsPage from "components/pages/SettingsPage";
import { DropZone } from "ui/upload/DropZone";
import projectActions from "store/features/project/projectActions";
import SoundsPage from "components/pages/SoundsPage";
import LoadingPane from "ui/loading/LoadingPane";
import styled from "styled-components";
import { useAppDispatch, useAppSelector } from "store/hooks";

const AppWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const AppContent = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`;

const App = () => {
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((state) => state.document.loaded);
  const section = useAppSelector((state) => state.navigation.section);
  const error = useAppSelector((state) => state.error);
  const [draggingOver, setDraggingOver] = useState(false);
  const dragTarget = useRef<EventTarget | null>(null);

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragTarget.current = e.target;
    setDraggingOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.target === dragTarget.current) {
      setDraggingOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggingOver(false);
      const files = Array.from(e.dataTransfer.files).map((f) => f.path);
      files.forEach((file) => dispatch(projectActions.addFileToProject(file)));
    },
    [dispatch],
  );

  useEffect(() => {
    window.addEventListener("dragover", (e) => e.preventDefault(), false);
    window.addEventListener("drop", (e) => e.preventDefault(), false);
  }, []);

  if (error.visible) {
    return <GlobalError />;
  }

  return (
    <AppWrapper onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <AppToolbar />
      {!loaded ? (
        <LoadingPane />
      ) : (
        <AppContent>
          {section === "world" && <WorldPage />}
          {section === "backgrounds" && <BackgroundsPage />}
          {section === "sprites" && <SpritesPage />}
          {section === "music" && <MusicPage />}
          {section === "sounds" && <SoundsPage />}
          {section === "dialogue" && <DialoguePage />}
          {section === "settings" && <SettingsPage />}
          {draggingOver && <DropZone />}
        </AppContent>
      )}
    </AppWrapper>
  );
};

export default App;
