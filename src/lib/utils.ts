export function toLowerCase(text: string): string {
  return text.toLowerCase();
}

export function toLowerCaseArray(arr: string[]): string[] {
  return arr.map(item => item.toLowerCase());
}

type Lowercaseable = string | string[] | { [key: string]: Lowercaseable } | number;

export function toLowerCaseObject<T extends { [key: string]: Lowercaseable }>(obj: T): T {
  const result = { ...obj };
  
  for (const key in result) {
    const value = result[key];
    if (typeof value === 'string') {
      result[key] = value.toLowerCase() as any;
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? item.toLowerCase() : item
      ) as any;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = toLowerCaseObject(value as any) as any;
    }
  }
  
  return result;
} 