import React, { useLayoutEffect, useRef, useState, FC } from "react";
import l10n from "shared/lib/lang/l10n";
import styled from "styled-components";
import { Button } from "ui/buttons/Button";
import projectIcon from "ui/icons/gbsproj.png";
import { CloseIcon } from "ui/icons/Icons";
import { StyledSplashTab, StyledSplashWindow } from "ui/splash/style";
import type { TemplatePlugin } from "lib/templates/templateManager";
import {
  Option,
  Select,
  SelectMenu,
  selectMenuStyleProps,
} from "ui/form/Select";
import { RelativePortal } from "ui/layout/RelativePortal";
import pluginPreview from "assets/templatePreview/plugin.png";

declare const VERSION: string;
declare const COMMITHASH: string;

interface SplashWindowProps {
  focus: boolean;
  children: React.ReactNode;
}

export const SplashWindow = ({ focus, children }: SplashWindowProps) => {
  return <StyledSplashWindow $focus={focus} children={children} />;
};

export const SplashSidebar = styled.div`
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.colors.sidebar.background};
  width: 200px;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: drag;
`;

export const SplashContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: ${(props) => props.theme.colors.background};
  color: ${(props) => props.theme.colors.text};
  padding: 20px;
  flex-grow: 1;
  -webkit-app-region: drag;
  input,
  select,
  button {
    -webkit-app-region: no-drag;
  }
`;

export const SplashForm = styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`;

export const SplashLogo = styled.div`
  position: relative;
  margin: 35px 20px 0;
  transition: transform 0.2s ease-in-out;

  &:hover {
    transform: scale(1.05);
  }
`;

export const SplashGBADevice = styled.div`
  position: relative;
  height: 92px;
  border-radius: 24px 24px 30px 30px;
  background: linear-gradient(180deg, #eef1f8 0%, #b9c1d5 100%);
  border: 2px solid #7c8498;
  box-shadow:
    inset 0 3px 0 rgba(255, 255, 255, 0.75),
    inset 0 -4px 0 rgba(0, 0, 0, 0.15),
    0 8px 18px rgba(0, 0, 0, 0.2);
`;

export const SplashGBAShoulder = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  top: -10px;
  ${(props) => props.$side}: 18px;
  width: 38px;
  height: 14px;
  border-radius: 10px 10px 4px 4px;
  background: #9aa3b8;
  border: 2px solid #737b8c;
  color: #4a5262;
  font-size: 8px;
  font-weight: bold;
  line-height: 12px;
  text-align: center;
`;

export const SplashGBAScreen = styled.div`
  position: absolute;
  left: 43px;
  top: 18px;
  width: 76px;
  height: 50px;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 40%),
    #222b35;
  border: 6px solid #555d6e;
  color: #98f59a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  text-align: center;
`;

export const SplashGBADPad = styled.div`
  position: absolute;
  left: 14px;
  top: 36px;
  width: 31px;
  height: 31px;

  &:before,
  &:after {
    content: "";
    position: absolute;
    background: #303745;
    border-radius: 4px;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.3);
  }

  &:before {
    left: 11px;
    top: 0;
    width: 9px;
    height: 31px;
  }

  &:after {
    left: 0;
    top: 11px;
    width: 31px;
    height: 9px;
  }
`;

export const SplashGBAFaceButtons = styled.div`
  position: absolute;
  right: 12px;
  top: 33px;
  width: 42px;
  height: 28px;

  &:before,
  &:after {
    position: absolute;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: #b0234b;
    color: #fff;
    font-size: 8px;
    font-weight: bold;
    line-height: 17px;
    text-align: center;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25);
  }

  &:before {
    content: "B";
    left: 0;
    top: 8px;
  }

  &:after {
    content: "A";
    right: 0;
    top: 0;
  }
`;

export const SplashGBASystemButtons = styled.div`
  position: absolute;
  left: 61px;
  bottom: 8px;
  display: flex;
  gap: 8px;

  span {
    display: block;
    width: 17px;
    height: 4px;
    border-radius: 4px;
    background: #5e6678;
    transform: rotate(-12deg);
  }
`;

export const SplashEasterEggButton = styled.button`
  position: absolute;
  left: 20px;
  top: 42px;
  width: 28px;
  height: 28px;
  border-radius: 20px;
  background-color: transparent;
  border: 0;
  -webkit-app-region: no-drag;
  cursor: pointer;

  &:hover {
    background: radial-gradient(
      circle,
      rgba(251, 63, 139, 0.2) 0%,
      rgba(252, 70, 107, 0) 100%
    );
  }

  &:active {
    background: radial-gradient(
      circle,
      rgba(251, 63, 139, 0.6) 0%,
      rgba(252, 70, 107, 0) 100%
    );
  }
`;

const SplashAppTitleWrapper = styled.div`
  color: ${(props) => props.theme.colors.secondaryText};
  font-size: 11px;
  text-align: center;
  margin-bottom: 20px;
  div {
    user-select: text;
  }
`;

export const SplashAppTitle = () => {
  const [showCommit, setShowCommit] = useState(false);
  const displayCommit = () => setShowCommit(true);
  return (
    <SplashAppTitleWrapper onClick={displayCommit}>
      {showCommit ? (
        <div>
          {VERSION} ({COMMITHASH})
        </div>
      ) : (
        `GBA Studio ${VERSION}`
      )}
    </SplashAppTitleWrapper>
  );
};

interface SplashTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const SplashTab = ({ selected, ...props }: SplashTabProps) => (
  <StyledSplashTab $selected={selected} {...props} />
);

export const SplashOpenButton = styled(Button).attrs(() => ({
  variant: "transparent",
}))`
  color: ${(props) => props.theme.colors.text};
  font-size: 13px;
  justify-content: flex-start;
  padding: 5px;
  margin: 15px;
  -webkit-app-region: no-drag;
`;

interface Template {
  id: string;
  name: string;
  preview: string;
  videoPreview: boolean;
  description: string;
}

interface SplashTemplateSelectProps {
  templates: Template[];
  templatePlugins: TemplatePlugin[];
  name: string;
  value: string;
  onChange: (newValue: string) => void;
}

const SplashTemplateSelectWrapper = styled.div`
  width: 100%;
`;

const SplashTemplateSelectOptions = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  margin-bottom: 5px;

  & > * {
    margin-right: 10px;
  }
`;

const SplashTemplateButtonWrapper = styled.div`
  position: relative;
`;

const SplashTemplateButton = styled.input.attrs({
  type: "radio",
})`
  width: 80px;
  height: 80px;
  margin: 0;
  padding: 0;
  border-radius: ${(props) => props.theme.borderRadius}px;
  -webkit-appearance: none;
  &:focus {
    box-shadow: 0 0 0px 4px ${(props) => props.theme.colors.highlight};
  }
`;

const SplashTemplateLabel = styled.label`
  position: absolute;
  top: 0;
  left: 0;
  width: 80px;
  height: 80px;
  background-color: #fff;
  border: 2px solid ${(props) => props.theme.colors.input.background};
  border-radius: ${(props) => props.theme.borderRadius}px;
  -webkit-appearance: none;
  box-sizing: border-box;

  img,
  video {
    width: 100%;
    height: 100%;
  }

  ${SplashTemplateButton}:checked + & {
    border: 2px solid ${(props) => props.theme.colors.highlight};
    box-shadow: 0 0 0px 2px ${(props) => props.theme.colors.highlight};
  }
`;

const SplashTemplateName = styled.div`
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 5px;
`;

const SplashTemplateDescription = styled.div`
  font-size: 11px;
`;

interface SplashTemplateVideoProps {
  src: string;
  playing: boolean;
}

const SplashTemplateVideo: FC<SplashTemplateVideoProps> = ({
  src,
  playing,
}) => {
  const ref = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      if (playing) {
        ref.current?.play();
      } else {
        ref.current?.pause();
      }
    }
  }, [playing, ref]);

  return <video ref={ref} src={src} muted loop />;
};

export const SplashTemplateSelect: FC<SplashTemplateSelectProps> = ({
  templates,
  templatePlugins,
  name,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPluginId, setSelectedPluginId] = useState(
    templatePlugins[0]?.id ?? "",
  );
  const selectedPlugin =
    templatePlugins.find((template) => template.id === selectedPluginId) ||
    templatePlugins[0];
  const selectedTemplate =
    templates.find((template) => template.id === value) ?? selectedPlugin;

  const templatePluginOptions: Option[] = templatePlugins.map((v) => ({
    value: v.id,
    label: v.name,
  }));

  const selectedTemplatePluginOption: Option =
    templatePluginOptions.find((t) => t.value === selectedPluginId) ??
    templatePluginOptions[0];

  return (
    <SplashTemplateSelectWrapper>
      <SplashTemplateSelectOptions>
        {templates.map((template) => (
          <SplashTemplateButtonWrapper key={template.id}>
            <SplashTemplateButton
              id={`${name}_${template.id}`}
              name={name}
              value={template.id}
              checked={template.id === value}
              onChange={() => onChange(template.id)}
            />
            <SplashTemplateLabel
              htmlFor={`${name}_${template.id}`}
              title={template.name}
            >
              {template.videoPreview ? (
                <SplashTemplateVideo
                  src={template.preview}
                  playing={template.id === value}
                />
              ) : (
                <img src={template.preview} alt={template.name} />
              )}
            </SplashTemplateLabel>
          </SplashTemplateButtonWrapper>
        ))}
        {selectedPlugin && (
          <SplashTemplateButtonWrapper key={selectedPlugin.id}>
            <SplashTemplateButton
              id={`${name}_${selectedPlugin.id}`}
              name={name}
              value={selectedPlugin.id}
              checked={selectedPlugin.id === value}
              onChange={() => onChange(selectedPlugin.id)}
              onClick={() => setIsOpen(true)}
            />
            <SplashTemplateLabel
              htmlFor={`${name}_${selectedPlugin.id}`}
              title={selectedPlugin.name}
            >
              <img
                src={selectedPlugin.preview}
                alt={selectedPlugin.name}
                onError={(e) =>
                  ((e.target as HTMLImageElement).src = pluginPreview)
                }
              />
            </SplashTemplateLabel>
            {isOpen && (
              <RelativePortal pin="top-right" offsetX={78}>
                <SelectMenu>
                  <Select
                    name={name}
                    options={templatePluginOptions}
                    value={selectedTemplatePluginOption}
                    onChange={(option) => {
                      if (option) {
                        setSelectedPluginId(option.value);
                        onChange(option.value);
                        setIsOpen(false);
                      }
                    }}
                    onBlur={() => {
                      setIsOpen(false);
                    }}
                    {...selectMenuStyleProps}
                  />
                </SelectMenu>
              </RelativePortal>
            )}
          </SplashTemplateButtonWrapper>
        )}
      </SplashTemplateSelectOptions>
      {selectedTemplate && (
        <>
          <SplashTemplateName>{selectedTemplate.name}</SplashTemplateName>
          <SplashTemplateDescription>
            {selectedTemplate.description}
          </SplashTemplateDescription>
        </>
      )}
    </SplashTemplateSelectWrapper>
  );
};

export const SplashCreateButton = styled.div`
  padding: 0px 10px;
`;

export const SplashScroll = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  background: ${(props) => props.theme.colors.background};
  color: ${(props) => props.theme.colors.text};
  position: relative;

  h2 {
    margin-top: 0;
  }
`;

export const SplashInfoMessage = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 13px;
  box-sizing: border-box;
  padding: 30px;
  text-align: center;
`;

export const SplashProjectClearButton = styled.div`
  display: flex;
  justify-content: center;
  padding: 30px;
`;

interface SplashProjectProps {
  project: {
    name: string;
    dir: string;
  };
  onClick: () => void;
  onRemove: () => void;
}

const SplashProjectRemoveButton = styled.div`
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease-in-out;
  transition-delay: 0.2s;
  background: ${(props) => props.theme.colors.input.background};
  border: 0;
  border-radius: 4px;
  width: 25px;
  height: 25px;

  svg {
    fill: ${(props) => props.theme.colors.text};
    width: 10px;
    height: 10px;
    max-width: 10px;
    max-height: 10px;
  }

  &:hover {
    cursor: pointer;
    svg {
      fill: ${(props) => props.theme.colors.highlight};
    }
  }
`;

const SplashProjectWrapper = styled.button`
  position: relative;
  display: flex;
  text-align: left;
  background: ${(props) => props.theme.colors.input.background};
  color: ${(props) => props.theme.colors.text};
  border: 0;
  border-bottom: 1px solid ${(props) => props.theme.colors.input.border};
  border-radius: 0px;
  padding: 15px 30px;
  width: 100%;

  img {
    width: 42px;
    margin-right: 10px;
  }

  ${SplashProjectRemoveButton} {
    opacity: 0;
  }

  &:hover {
    background: ${(props) => props.theme.colors.input.hoverBackground};
    ${SplashProjectRemoveButton} {
      opacity: 1;
    }
  }

  &:active {
    background: ${(props) => props.theme.colors.input.activeBackground};
  }

  &:focus {
    background: transparent;
    box-shadow: inset 0 0 0px 2px #c92c61;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const SplashProjectDetails = styled.span`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SplashProjectName = styled.span`
  display: block;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SplashProjectPath = styled.span`
  display: block;
  font-size: 11px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SplashLoading = styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
`;

export const SplashProject: FC<SplashProjectProps> = ({
  project,
  onClick,
  onRemove,
}) => (
  <SplashProjectWrapper onClick={onClick}>
    <img src={projectIcon} alt="" />
    <SplashProjectDetails>
      <SplashProjectName>{project.name}</SplashProjectName>
      <SplashProjectPath>{project.dir}</SplashProjectPath>
    </SplashProjectDetails>
    <SplashProjectRemoveButton
      title={l10n("SPLASH_REMOVE_FROM_RECENT")}
      onClick={
        onRemove
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          : undefined
      }
    >
      <CloseIcon />
    </SplashProjectRemoveButton>
  </SplashProjectWrapper>
);
