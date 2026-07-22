import { useRef, useEffect } from 'react';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { useBlockFormState } from '@/hooks/useBlockFormState';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/primitives/drawer';
import { Button } from '@/components/primitives/button';
import { Input } from '@/components/primitives/input';
import { Label } from '@/components/primitives/label';
import { Textarea } from '@/components/primitives/textarea';
import { Lock, Unlock, Trash2, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/primitives/select';
import { PersonAvatar } from '../atoms/PersonAvatar';
import { DEBOUNCE_TIMES } from '@/lib/timing';

interface BlockEditDialogProps {
  item: WorkshopItem | null;
  blockTypes: BlockType[];
  persons: Person[];
  onClose: () => void;
  onSave: (updates: Partial<WorkshopItem>) => void;
  onAutoSave?: (updates: Partial<WorkshopItem>) => void;
  onDelete?: () => void;
  focusField?: 'fixedStartTime';
}

export const BlockEditDialog = ({
  item,
  blockTypes,
  persons,
  onClose,
  onSave,
  onAutoSave,
  onDelete,
  focusField,
}: BlockEditDialogProps) => {
  const isMobile = useIsMobile();
  const { formData, setFormData, handleSave, handleTextareaKeyDown, handleTextareaBlur } =
    useBlockFormState(item, onSave);
  const { t } = useTranslation('common');

  const fixedStartTimeRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);

  // Auto-focus the requested field when dialog opens
  useEffect(() => {
    if (!item) return;
    if (focusField === 'fixedStartTime') {
      const timer = setTimeout(() => fixedStartTimeRef.current?.focus(), DEBOUNCE_TIMES.FOCUS_FIXED_START);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, focusField]);

  const getDialogTitle = () => {
    if (!item) return t('dialog.edit');
    switch (item.type) {
      case 'group':
        return t('dialog.editGroup');
      case 'breakout':
        return t('dialog.editBreakout');
      default:
        return t('dialog.editBlock');
    }
  };

  // Auto-save helper for mobile drawer: save without closing
  const autoSave = (updates: Partial<WorkshopItem>) => {
    if (isMobile && onAutoSave) {
      onAutoSave(updates);
    }
  };

  const handleFieldChange = <K extends keyof WorkshopItem>(field: K, value: WorkshopItem[K]) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      autoSave(next as Partial<WorkshopItem>);
      return next;
    });
  };

  const formContent = (
    <div className="space-y-4 py-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{t('dialog.title')}</Label>
        <Input
          id="title"
          value={formData.title || ''}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          placeholder={t('block.titlePlaceholder')}
        />
      </div>

      {/* Block Type - nur für Blöcke */}
      {item?.type === 'block' && (
        <div className="space-y-2">
          <Label>{t('dialog.blockType')}</Label>
          <Select
            value={formData.blockTypeId || ''}
            onValueChange={(value) => handleFieldChange('blockTypeId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('dialog.selectType')} />
            </SelectTrigger>
            <SelectContent>
              {blockTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  <span className="flex items-center gap-2">
                    <span>{getBlockTypeName(type, t)}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Breakout-spezifische Felder */}
      {item?.type === 'breakout' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="lanes">{t('dialog.rooms')}</Label>
            <Input
              id="lanes"
              type="number"
              value={formData.lanes || 2}
              onChange={(e) => handleFieldChange('lanes', parseInt(e.target.value) || 2)}
              min={1}
              max={10}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="sameInAllBreakouts"
              type="checkbox"
              checked={formData.sameInAllBreakouts || false}
              onChange={(e) => handleFieldChange('sameInAllBreakouts', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="sameInAllBreakouts" className="cursor-pointer">
              {t('dialog.sameInAllRooms')}
            </Label>
          </div>
        </>
      )}

      <div className="flex flex-row justify-between items-start gap-4">
        {/* Fixed start time */}
        <div className="basis-1/2 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="fixedStartTime">{t('dialog.fixedStartTime')}</Label>
            <button
              type="button"
              onClick={() => {
                if (formData.fixedStartTime) {
                  handleFieldChange('fixedStartTime', undefined);
                } else {
                  fixedStartTimeRef.current?.focus();
                }
              }}
              className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
              title={formData.fixedStartTime ? t('dialog.clearFixedStartTime') : t('dialog.lockStartTime')}
            >
              {formData.fixedStartTime ? (
                <><Lock className="h-3.5 w-3.5 text-primary" /><span className="text-primary">{t('dialog.fixedStartTimeActive')}</span></>
              ) : (
                <><Unlock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{t('dialog.lockFree')}</span></>
              )}
            </button>
          </div>
          <Input
            ref={fixedStartTimeRef}
            id="fixedStartTime"
            type="time"
            value={formData.fixedStartTime || ''}
            onChange={(e) => {
              const val = e.target.value;
              handleFieldChange('fixedStartTime', val || undefined);
            }}
          />
        </div>

        {/* Duration */}
        <div className="basis-1/2 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="duration">{t('dialog.duration')}</Label>
            {(item?.type === 'group' || item?.type === 'breakout') && (
              <button
                type="button"
                onClick={() => {
                  const next = !formData.durationLocked;
                  handleFieldChange('durationLocked', next);
                  if (next) setTimeout(() => durationRef.current?.focus(), 0);
                }}
                className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
                title={formData.durationLocked ? t('dialog.unlockDuration') : t('dialog.lockDuration')}
              >
                {formData.durationLocked ? (
                  <><Lock className="h-3.5 w-3.5 text-primary" /><span className="text-primary">{t('dialog.lockManual')}</span></>
                ) : (
                  <><Unlock className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{t('dialog.lockAuto')}</span></>
                )}
              </button>
            )}
          </div>
          <div
            onClick={() => {
              if ((item?.type === 'group' || item?.type === 'breakout') && !formData.durationLocked) {
                handleFieldChange('durationLocked', true);
                setTimeout(() => durationRef.current?.focus(), 0);
              }
            }}
            className={(item?.type === 'group' || item?.type === 'breakout') && !formData.durationLocked ? 'cursor-pointer' : ''}
          >
            <Input
              ref={durationRef}
              id="duration"
              type="number"
              value={formData.duration || 0}
              onChange={(e) => handleFieldChange('duration', parseInt(e.target.value) || 0)}
              min={0}
              disabled={(item?.type === 'group' || item?.type === 'breakout') && !formData.durationLocked}
              className={(item?.type === 'group' || item?.type === 'breakout') && !formData.durationLocked ? 'opacity-50 pointer-events-none' : ''}
            />
          </div>
          {(item?.type === 'group' || item?.type === 'breakout') && !formData.durationLocked && (
            <p className="text-xs text-muted-foreground">{t('dialog.autoCalculated')}</p>
          )}
        </div>
      </div>

      {/* Persons */}
      {persons.length > 0 && (
        <div className="space-y-2">
          <Label>{t('dialog.persons')}</Label>
          <div className="flex flex-wrap gap-2">
            {persons.map(person => {
              const isSelected = (formData.personIds || []).includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    const current = formData.personIds || [];
                    handleFieldChange('personIds', isSelected
                      ? current.filter(id => id !== person.id)
                      : [...current, person.id]);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <PersonAvatar name={person.name} color={person.color} size="xs" />
                  <span className="text-sm">{person.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="notes">{t('dialog.notes')}</Label>
          <span className="text-xs text-muted-foreground">
            _<em>kursiv</em>_ *<strong>fett</strong>* 
          </span>
        </div>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          onKeyDown={(e) => handleTextareaKeyDown(e, 'notes')}
          onBlur={(e) => {
            handleTextareaBlur('notes', e.target.value);
            if (isMobile) autoSave({ ...formData, notes: e.target.value });
          }}
          placeholder={t('dialog.notesPlaceholder')}
          rows={4}
        />
      </div>

      {/* Material */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="material">{t('dialog.material')}</Label>
          <span className="text-xs text-muted-foreground">
            _<em>kursiv</em>_ *<strong>fett</strong>* 
          </span>
        </div>
        <Textarea
          id="material"
          value={formData.material || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
          onKeyDown={(e) => handleTextareaKeyDown(e, 'material')}
          onBlur={(e) => {
            handleTextareaBlur('material', e.target.value);
            if (isMobile) autoSave({ ...formData, material: e.target.value });
          }}
          placeholder={t('dialog.materialPlaceholder')}
          rows={2}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{getDialogTitle()}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4">
            {formContent}
          </div>
          <DrawerFooter className="flex-row justify-between pt-2">
            {onDelete && (
              <Button
                variant="ghost"
                onClick={() => { onDelete(); onClose(); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('dialog.delete')}
              </Button>
            )}
            <Button className="ml-auto" onClick={onClose}>
              {t('dialog.done')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        {formContent}

        <div className="flex justify-between gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => { onDelete(); onClose(); }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('dialog.delete')}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('dialog.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
