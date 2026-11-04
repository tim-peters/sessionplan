import { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkshopItem } from '@/types/workshop';
import { autoLinkUrls } from '@/lib/textFormatting';

const toFormData = (item: WorkshopItem): Partial<WorkshopItem> => ({
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

/**
 * Manages form state and auto-linking for BlockEditDialog.
 */
export const useBlockFormState = (item: WorkshopItem | null, onSave: (updates: Partial<WorkshopItem>) => void) => {
  const [formData, setFormData] = useState<Partial<WorkshopItem>>({});

  useEffect(() => {
    if (item) {
      setFormData(toFormData(item));
    }
  }, [item]);

  const hasUnsavedChanges = useMemo(
    () => !!item
      && Object.keys(formData).length > 0
      && JSON.stringify(formData) !== JSON.stringify(toFormData(item)),
    [formData, item],
  );

  const handleSave = useCallback(() => {
    onSave(formData);
  }, [formData, onSave]);

  const handleTextareaBlur = useCallback((field: 'notes' | 'material', value: string) => {
    const newValue = autoLinkUrls(value);
    if (newValue !== value) {
      setFormData(prev => ({ ...prev, [field]: newValue }));
    }
  }, []);

  return { formData, setFormData, handleSave, handleTextareaBlur, hasUnsavedChanges };
};
