export interface StoredMenu {
  id: number;
  name: string;
  type?: number;
  url?: string | null;
  icon?: string | null;
  parentId?: number | null;
  sortOrder?: number | null;
  deletedFlag?: number;
  visiblity?: number;
  visibility?: number;
  [key: string]: unknown;
}

export function normalizeStoredMenus(value: unknown): StoredMenu[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeStoredMenu(item))
    .filter((menu): menu is StoredMenu => menu !== null);
}

export function isStoredMenuVisible(menu: Pick<StoredMenu, 'visiblity' | 'visibility'>): boolean {
  return (menu.visiblity ?? menu.visibility ?? 1) === 1;
}

function normalizeStoredMenu(item: unknown): StoredMenu | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const menu = item as Record<string, unknown>;
  const id = toNullableNumber(menu['id']);
  const name = toNullableString(menu['name']);

  if (id === null || !name) {
    return null;
  }

  return {
    ...menu,
    id,
    name,
    type: toOptionalNumber(menu['type']),
    url: toNullableString(menu['url']),
    icon: toNullableString(menu['icon']),
    parentId: toNullableNumber(menu['parentId']),
    sortOrder: toNullableNumber(menu['sortOrder']),
    deletedFlag: toOptionalNumber(menu['deletedFlag']),
    visiblity: toOptionalNumber(menu['visiblity']),
    visibility: toOptionalNumber(menu['visibility']),
  };
}

function toOptionalNumber(value: unknown): number | undefined {
  return toNullableNumber(value) ?? undefined;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length ? trimmedValue : null;
}
