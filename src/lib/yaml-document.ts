// One-document YAML files (site.yaml) are exposed as a one-entry collection so they pass through the
// same Zod schemas and any error fails the build with the file and the field.
import { parse } from 'yaml';

export function singleDocument(id: string): (text: string) => { id: string }[] {
  return (text) => {
    const data: unknown = parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error(`expected a YAML mapping for the "${id}" document`);
    }
    return [{ ...data, id }];
  };
}
