export function buildSelectionToggleLabel(language: string, isAllSelected: boolean) {
  if (language === 'en-US') {
    return isAllSelected ? 'Deselect All' : 'Select All';
  }

  return isAllSelected ? '全不选' : '全选';
}

export function buildSelectionHeaderTitle(language: string, selectedCount: number) {
  if (language === 'en-US') {
    return `${selectedCount} selected`;
  }

  return `已选 ${selectedCount} 项`;
}
