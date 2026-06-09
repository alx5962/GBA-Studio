import React, { FC, useCallback } from "react";
import { FormContainer, FormField, FormRow } from "ui/form/layout/FormLayout";
import entitiesActions from "store/features/entities/entitiesActions";
import {
  ActorNormalized,
  CollisionGroup,
  SpriteSheetNormalized,
} from "shared/lib/entities/entitiesTypes";
import { SidebarColumn } from "ui/sidebars/Sidebar";
import { SpriteSheetSelectButton } from "components/forms/SpriteSheetSelectButton";
import { AnimationSpeedSelect } from "components/forms/AnimationSpeedSelect";
import { MovementSpeedSelect } from "components/forms/MovementSpeedSelect";
import CollisionMaskPicker from "components/forms/CollisionMaskPicker";
import { NumberInput } from "ui/form/NumberInput";
import l10n from "shared/lib/lang/l10n";
import { useAppDispatch, useAppSelector } from "store/hooks";
import { ActorEditorExtraCollisionFlags } from "./ActorEditorExtraCollisionFlags";
import { sceneSelectors } from "store/features/entities/entitiesState";

interface ActorEditorPropertiesProps {
  actor: ActorNormalized;
  sceneId?: string;
}

export const ActorEditorProperties: FC<ActorEditorPropertiesProps> = ({
  actor,
  sceneId,
}) => {
  const dispatch = useAppDispatch();

  const defaultSpriteMode = useAppSelector(
    (state) => state.project.present.settings.spriteMode,
  );
  const scene = useAppSelector((state) =>
    sceneSelectors.selectById(state, sceneId ?? ""),
  );

  const sceneSpriteMode = scene?.spriteMode ?? defaultSpriteMode;
  const isIsometric = scene?.type === "ISOMETRIC";

  const onChangeActorProp = useCallback(
    <K extends keyof ActorNormalized>(key: K, value: ActorNormalized[K]) => {
      dispatch(
        entitiesActions.editActor({
          actorId: actor.id,
          changes: {
            [key]: value,
          },
        }),
      );
    },
    [dispatch, actor.id],
  );

  const onChangeSpriteSheetId = useCallback(
    (e: string) => onChangeActorProp("spriteSheetId", e),
    [onChangeActorProp],
  );

  const onChangeMoveSpeed = useCallback(
    (e: number) => onChangeActorProp("moveSpeed", e),
    [onChangeActorProp],
  );

  const onChangeAnimSpeed = useCallback(
    (e: number) => onChangeActorProp("animSpeed", e),
    [onChangeActorProp],
  );

  const onChangeIsoZ = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChangeActorProp("isoZ", Math.max(0, parseInt(e.currentTarget.value, 10) || 0)),
    [onChangeActorProp],
  );

  const onChangeCollisionGroup = useCallback(
    (e: CollisionGroup) => onChangeActorProp("collisionGroup", e),
    [onChangeActorProp],
  );

  const onlyCurrentSpriteMode = useCallback(
    (spriteSheet: SpriteSheetNormalized) => {
      return (spriteSheet.spriteMode ?? defaultSpriteMode) === sceneSpriteMode;
    },
    [defaultSpriteMode, sceneSpriteMode],
  );

  if (!actor) {
    return <div />;
  }

  const showAnimSpeed = true;

  const showCollisionGroup = !actor.isPinned;

  return (
    <>
      <SidebarColumn>
        <FormContainer>
          <FormRow>
            <FormField name="actorSprite" label={l10n("FIELD_SPRITE_SHEET")}>
              <SpriteSheetSelectButton
                name="actorSprite"
                value={actor.spriteSheetId}
                direction={actor.direction}
                frame={0}
                filter={onlyCurrentSpriteMode}
                onChange={onChangeSpriteSheetId}
                includeInfo
              />
            </FormField>
          </FormRow>
        </FormContainer>
      </SidebarColumn>
      {isIsometric && (
        <SidebarColumn>
          <FormContainer>
            <FormRow>
              <FormField
                name="actorIsoZ"
                label={l10n("FIELD_ISO_Z")}
                title={l10n("FIELD_ISO_Z_DESC")}
              >
                <NumberInput
                  name="actorIsoZ"
                  type="number"
                  value={actor.isoZ ?? 0}
                  min={0}
                  max={31}
                  placeholder="0"
                  onChange={onChangeIsoZ}
                />
              </FormField>
            </FormRow>
          </FormContainer>
        </SidebarColumn>
      )}
      <SidebarColumn>
        <FormContainer>
          <FormRow>
            <FormField
              name="actorMoveSpeed"
              label={l10n("FIELD_MOVEMENT_SPEED")}
            >
              <MovementSpeedSelect
                name="actorMoveSpeed"
                value={actor.moveSpeed}
                onChange={onChangeMoveSpeed}
              />
            </FormField>
            {showAnimSpeed && (
              <FormField
                name="actorAnimSpeed"
                label={l10n("FIELD_ANIMATION_SPEED")}
              >
                <AnimationSpeedSelect
                  name="actorAnimSpeed"
                  value={actor.animSpeed}
                  onChange={onChangeAnimSpeed}
                />
              </FormField>
            )}
          </FormRow>
        </FormContainer>
      </SidebarColumn>
      {showCollisionGroup && (
        <SidebarColumn>
          <FormContainer>
            <FormRow>
              <FormField
                name="actorCollisionGroup"
                label={l10n("FIELD_COLLISION_GROUP")}
              >
                <CollisionMaskPicker
                  id="actorCollisionGroup"
                  value={actor.collisionGroup}
                  onChange={onChangeCollisionGroup}
                  includeNone
                />
              </FormField>
            </FormRow>
            <ActorEditorExtraCollisionFlags actor={actor} sceneId={sceneId} />
          </FormContainer>
        </SidebarColumn>
      )}
    </>
  );
};
