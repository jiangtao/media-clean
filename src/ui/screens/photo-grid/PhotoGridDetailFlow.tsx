import React from 'react';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { AppLanguage } from '../../../i18n/app-language';
import type { AppThemePalette } from '../../../theme/app-theme';
import { DetailScreen } from '../DetailScreen';

interface PhotoGridDetailFlowProps {
  candidate: CleanupCandidate;
  duplicateCandidates: CleanupCandidate[];
  language: AppLanguage;
  theme: AppThemePalette;
  onClose: () => void;
  onPrimaryAction: (ids?: string[]) => void | Promise<void>;
  onHardDelete: (ids?: string[]) => void | Promise<void>;
  onKeep: (ids?: string[]) => void | Promise<void>;
}

const DetailScreenCompat = DetailScreen as unknown as React.ComponentType<
  React.ComponentProps<typeof DetailScreen> & {
    onKeep?: (ids?: string[]) => void | Promise<void>;
  }
>;

export function PhotoGridDetailFlow({
  candidate,
  duplicateCandidates,
  language,
  theme,
  onClose,
  onPrimaryAction,
  onHardDelete,
  onKeep,
}: PhotoGridDetailFlowProps) {
  return (
    <DetailScreenCompat
      candidate={candidate}
      duplicateCandidates={duplicateCandidates}
      language={language}
      theme={theme}
      mode="suggestions"
      onClose={onClose}
      onPrimaryAction={onPrimaryAction}
      onHardDelete={onHardDelete}
      onKeep={onKeep}
    />
  );
}
