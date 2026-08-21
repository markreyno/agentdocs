declare module 'mammoth' {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: { styleMap?: string | string[] },
  ): Promise<{ value: string; messages: { type: string; message: string }[] }>

  const mammoth: { convertToHtml: typeof convertToHtml }
  export default mammoth
}
