export const requireRouteParam = (
  value: string | string[] | undefined,
  name: string
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  if (value) {
    return value;
  }

  throw new Error(`Missing route parameter: ${name}`);
};
