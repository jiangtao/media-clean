import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { DesignIcon } from '../icons/DesignIcon';
import { Text, TouchSurface } from '../primitives';

export const ACTION_SWITCH_STYLE_TOKENS = COMPONENT_TOKENS.actionSwitch;

type ActionTone = 'neutral' | 'danger' | 'keep';
type ActionIconName = AppIconName;

interface ActionSwitchProps {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
  primaryIcon?: ActionIconName;
  secondaryIcon?: ActionIconName;
  primaryTone?: ActionTone;
  secondaryTone?: ActionTone;
  selectedAction?: 'primary' | 'secondary' | null;
  testID?: string;
  primaryTestID?: string;
  secondaryTestID?: string;
  density?: 'regular' | 'compact';
}

export const ActionSwitch = memo(function ActionSwitch({
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  primaryIcon,
  secondaryIcon,
  primaryTone = 'danger',
  secondaryTone = 'keep',
  selectedAction = null,
  testID = 'action-switch',
  primaryTestID = 'action-switch-primary',
  secondaryTestID = 'action-switch-secondary',
  density = 'regular',
}: ActionSwitchProps) {
  const styles = useMemo(() => createStyles(density), [density]);
  const iconSize = density === 'compact'
    ? ACTION_SWITCH_STYLE_TOKENS.size.iconCompact
    : ACTION_SWITCH_STYLE_TOKENS.size.iconRegular;

  return (
    <View style={styles.actionSwitch} testID={testID}>
      <TouchSurface
        onPress={onPrimaryPress}
        style={[
          styles.actionSegment,
          selectedAction === 'primary'
            ? resolveActiveSegmentStyle(primaryTone, styles)
            : styles.inactiveActionSegment,
        ]}
        preset="pill"
        testID={primaryTestID}
      >
        <View style={styles.actionContent}>
          {primaryIcon ? (
            renderActionIcon(
              primaryIcon,
              selectedAction === 'primary'
                ? ACTION_SWITCH_STYLE_TOKENS.color.activeText
                : ACTION_SWITCH_STYLE_TOKENS.color.inactiveIcon,
              iconSize,
              `${primaryTestID}-icon`,
            )
          ) : null}
          <Text
            style={[
              styles.actionText,
              selectedAction === 'primary' ? styles.activeActionText : styles.inactiveActionText,
            ]}
          >
            {primaryLabel}
          </Text>
        </View>
      </TouchSurface>
      <TouchSurface
        onPress={onSecondaryPress}
        style={[
          styles.actionSegment,
          selectedAction === 'secondary'
            ? resolveActiveSegmentStyle(secondaryTone, styles)
            : styles.inactiveActionSegment,
        ]}
        preset="pill"
        testID={secondaryTestID}
      >
        <View style={styles.actionContent}>
          {secondaryIcon ? (
            renderActionIcon(
              secondaryIcon,
              selectedAction === 'secondary'
                ? ACTION_SWITCH_STYLE_TOKENS.color.activeText
                : ACTION_SWITCH_STYLE_TOKENS.color.inactiveIcon,
              iconSize,
              `${secondaryTestID}-icon`,
            )
          ) : null}
          <Text
            style={[
              styles.actionText,
              selectedAction === 'secondary' ? styles.activeActionText : styles.inactiveActionText,
            ]}
          >
            {secondaryLabel}
          </Text>
        </View>
      </TouchSurface>
    </View>
  );
});

function renderActionIcon(
  name: ActionIconName,
  color: string,
  size: number,
  testID: string,
) {
  if (String(name).includes('checkmark')) {
    return <DesignIcon name="check" width={size} height={size} color={color} testID={testID} />;
  }

  if (String(name).includes('trash')) {
    return <DesignIcon name="nav-trash" width={size} height={size} color={color} testID={testID} />;
  }

  return <AppIcon name={name} size={size} color={color} testID={testID} />;
}

function resolveActiveSegmentStyle(
  tone: ActionTone,
  styles: ReturnType<typeof createStyles>,
) {
  switch (tone) {
    case 'keep':
      return styles.keepActionSegment;
    case 'neutral':
      return styles.neutralActionSegment;
    case 'danger':
    default:
      return styles.dangerActionSegment;
  }
}

function createStyles(density: 'regular' | 'compact') {
  const compact = density === 'compact';

  return StyleSheet.create({
    actionSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? ACTION_SWITCH_STYLE_TOKENS.gap.compact : ACTION_SWITCH_STYLE_TOKENS.gap.regular,
      padding: 0,
      borderRadius: compact
        ? ACTION_SWITCH_STYLE_TOKENS.radius.compact
        : ACTION_SWITCH_STYLE_TOKENS.radius.regular,
      backgroundColor: 'transparent',
    },
    actionSegment: {
      minWidth: compact
        ? ACTION_SWITCH_STYLE_TOKENS.size.segmentMinWidthCompact
        : ACTION_SWITCH_STYLE_TOKENS.size.segmentMinWidthRegular,
      height: compact
        ? ACTION_SWITCH_STYLE_TOKENS.size.segmentHeightCompact
        : ACTION_SWITCH_STYLE_TOKENS.size.segmentHeightRegular,
      borderRadius: compact
        ? ACTION_SWITCH_STYLE_TOKENS.radius.compact
        : ACTION_SWITCH_STYLE_TOKENS.radius.regular,
      paddingHorizontal: compact
        ? ACTION_SWITCH_STYLE_TOKENS.size.segmentPaddingHorizontalCompact
        : ACTION_SWITCH_STYLE_TOKENS.size.segmentPaddingHorizontalRegular,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact
        ? ACTION_SWITCH_STYLE_TOKENS.gap.contentCompact
        : ACTION_SWITCH_STYLE_TOKENS.gap.contentRegular,
    },
    inactiveActionSegment: {},
    keepActionSegment: {
      backgroundColor: ACTION_SWITCH_STYLE_TOKENS.color.keepBackground,
    },
    dangerActionSegment: {
      backgroundColor: ACTION_SWITCH_STYLE_TOKENS.color.dangerBackground,
    },
    neutralActionSegment: {
      backgroundColor: ACTION_SWITCH_STYLE_TOKENS.color.neutralBackground,
    },
    actionText: {
      fontSize: compact
        ? ACTION_SWITCH_STYLE_TOKENS.typography.fontSizeCompact
        : ACTION_SWITCH_STYLE_TOKENS.typography.fontSizeRegular,
      fontWeight: ACTION_SWITCH_STYLE_TOKENS.typography.fontWeight,
      letterSpacing: compact
        ? ACTION_SWITCH_STYLE_TOKENS.typography.letterSpacingCompact
        : ACTION_SWITCH_STYLE_TOKENS.typography.letterSpacingRegular,
    },
    activeActionText: {
      color: ACTION_SWITCH_STYLE_TOKENS.color.activeText,
    },
    inactiveActionText: {
      color: ACTION_SWITCH_STYLE_TOKENS.color.inactiveText,
    },
  });
}
