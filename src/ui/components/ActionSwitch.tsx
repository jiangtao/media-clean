import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { DesignIcon } from '../icons/DesignIcon';
import { TouchSurface } from './TouchSurface';

const SIZE_DEFAULT = 14;
const SIZE_SMALL = 12;
const MUTED_DANGER = '#d8646a';
const MUTED_KEEP = '#18bf63';

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
              selectedAction === 'primary' ? '#ffffff' : 'rgba(255, 255, 255, 0.74)',
              density === 'compact' ? SIZE_SMALL : SIZE_DEFAULT,
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
              selectedAction === 'secondary' ? '#ffffff' : 'rgba(255, 255, 255, 0.74)',
              density === 'compact' ? SIZE_SMALL : SIZE_DEFAULT,
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
      gap: compact ? 4 : 6,
      padding: 0,
      borderRadius: compact ? 16 : 18,
      backgroundColor: 'transparent',
    },
    actionSegment: {
      minWidth: compact ? 56 : 64,
      height: compact ? 32 : 36,
      borderRadius: compact ? 16 : 18,
      paddingHorizontal: compact ? 10 : 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: compact ? 4 : 5,
    },
    inactiveActionSegment: {},
    keepActionSegment: {
      backgroundColor: MUTED_KEEP,
    },
    dangerActionSegment: {
      backgroundColor: MUTED_DANGER,
    },
    neutralActionSegment: {
      backgroundColor: '#242424',
    },
    actionText: {
      fontSize: compact ? SIZE_SMALL : SIZE_DEFAULT,
      fontWeight: '800',
      letterSpacing: compact ? 0.1 : 0.2,
    },
    activeActionText: {
      color: '#ffffff',
    },
    inactiveActionText: {
      color: 'rgba(255, 255, 255, 0.78)',
    },
  });
}
