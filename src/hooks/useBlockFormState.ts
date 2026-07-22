import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { WorkshopItem } from '@/types/workshop';
import { autoLinkUrls } from '@/lib/textFormatting';

/**
 * Manages form state, keyboard shortcuts, and auto-linking for BlockEditDialog.
 */
export const useBlockFormState = (item: WorkshopItem | null, onSave: (updates: Partial<WorkshopItem>) => void) => {
  const [formData, setFormData] = useState<Partial<WorkshopItem>>({});

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        duration: item.duration,
        durationLocked: item.durationLocked,
        blockTypeId: item.blockTypeId,
        notes: item.notes,
        material: item.material,
        lanes: item.lanes,
        sameInAllBreakouts: item.sameInAllBreakouts,
        personIds: item.personIds || [],
        fixedStartTime: item.fixedStartTime,
      });
    }
  }, [item]);

  const handleSave = useCallback(() => {
    onSave(formData);
  }, [formData, onSave]);

  const handleTextareaKeyDown = useCallback((
    e: KeyboardEvent<HTMLTextAreaElement>,
    field: 'notes' | 'material'
  ) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (!modKey) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    let wrapper = '';
    let shouldPrevent = false;

    if (e.key === 'b' || e.key === 'B') {
      wrapper = '*';
      shouldPrevent = true;
    } else if (e.key === 'i' || e.key === 'I') {
      wrapper = '_';
      shouldPrevent = true;
    } else if (e.key === 'k' || e.key === 'K') {
      if (selectedText) {
        e.preventDefault();
        const url = prompt('URL eingeben:', 'https://');
        if (url) {
          const newText =
            textarea.value.substring(0, start) +
            `[${selectedText}](${url})` +
            textarea.value.substring(end);
          setFormData(prev => ({ ...prev, [field]: newText }));
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              start + selectedText.length + url.length + 4;
            textarea.focus();
          }, 0);
        }
        return;
      }
    }

    if (shouldPrevent && wrapper) {
      e.preventDefault();
      const newText =
        textarea.value.substring(0, start) +
        wrapper + selectedText + wrapper +
        textarea.value.substring(end);
      setFormData(prev => ({ ...prev, [field]: newText }));
      setTimeout(() => {
        if (selectedText) {
          textarea.selectionStart = start + wrapper.length;
          textarea.selectionEnd = end + wrapper.length;
        } else {
          textarea.selectionStart = textarea.selectionEnd = start + wrapper.length;
        }
        textarea.focus();
      }, 0);
    }
  }, []);

  const handleTextareaBlur = useCallback((field: 'notes' | 'material', value: string) => {
    const newValue = autoLinkUrls(value);
    if (newValue !== value) {
      setFormData(prev => ({ ...prev, [field]: newValue }));
    }
  }, []);

  return { formData, setFormData, handleSave, handleTextareaKeyDown, handleTextareaBlur };
};
