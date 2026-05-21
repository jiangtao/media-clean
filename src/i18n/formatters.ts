export type I18nTemplateValue = string | number | boolean;

export function formatI18nTemplate(
  template: string,
  values: Record<string, I18nTemplateValue>,
): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing i18n template value: ${key}`);
    }

    return String(value);
  });
}

export function formatEnglishPluralSuffix(count: number): string {
  return count === 1 ? '' : 's';
}
