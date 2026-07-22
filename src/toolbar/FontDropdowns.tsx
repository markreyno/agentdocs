import { Editor } from '@tiptap/react'
import { ComboDropdown } from './ComboDropdown'
import { FONT_FAMILIES, FONT_SIZES } from './constants'

export function FontFamilyDropdown({ editor }: { editor: Editor }) {
  const currentFamily = editor.getAttributes('textStyle').fontFamily as string | undefined

  return (
    <ComboDropdown
      buttonLabel="Font"
      listAriaLabel="Font families"
      options={FONT_FAMILIES}
      selectedValue={currentFamily ?? FONT_FAMILIES[0].value}
      isActive={currentFamily !== undefined}
      widthClass="min-w-[8.5rem]"
      onSelect={(value) => editor.chain().focus().setFontFamily(value).run()}
    />
  )
}

export function FontSizeDropdown({ editor }: { editor: Editor }) {
  const currentSize = editor.getAttributes('textStyle').fontSize as string | undefined

  return (
    <ComboDropdown
      buttonLabel="Size"
      listAriaLabel="Font sizes"
      options={FONT_SIZES}
      selectedValue={currentSize ?? '11px'}
      widthClass="min-w-[3rem]"
      onSelect={(value) => editor.chain().focus().setFontSize(value).run()}
    />
  )
}
