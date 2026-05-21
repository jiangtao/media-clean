import { normalizeAppLanguage } from '../../../i18n/app-language';
import { getAppCopy } from '../../../i18n/app-copy';

export function buildSelectionToggleLabel(language: string, isAllSelected: boolean) {
  const copy = getAppCopy(normalizeAppLanguage(language)).screens.photoGrid;
  return isAllSelected ? copy.selectionModeDeselectAll : copy.selectionModeSelectAll;
}

export function buildSelectionHeaderTitle(language: string, selectedCount: number) {
  return getAppCopy(normalizeAppLanguage(language)).screens.photoGrid.selectionModeSelectedItems(
    selectedCount,
  );
}
