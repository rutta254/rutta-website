export type DesignCode = 'eurocode' | 'aisc' | 'asce' | 'aci';

export function checkDesignPlaceholder(code: DesignCode, params: any) {
  // Small placeholder to branch by code in future implementations.
  return { code, ok: true, message: `Design check for ${code} not implemented yet` };
}
