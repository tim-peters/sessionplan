import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BlockTypesPanel } from '@/modules/sidebar/BlockTypesPanel';
import { BlockType } from '@/types/workshop';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'blockTypes.break' ? '☕ Break' : key),
  }),
}));

const renderEditForm = (type: BlockType) => {
  const onUpdateBlockType = vi.fn();
  render(
    <BlockTypesPanel
      blockTypes={[type]}
      isOpen
      onToggle={vi.fn()}
      onAddBlock={vi.fn()}
      onAddGroup={vi.fn()}
      onAddBreakout={vi.fn()}
      onAddBlockType={vi.fn()}
      editingBlockTypeId={type.id}
      onStartEditBlockType={vi.fn()}
      onUpdateBlockType={onUpdateBlockType}
      onRequestDeleteBlockType={vi.fn()}
      showNewTypeForm={false}
      newTypeColor="#000000"
      onShowNewTypeForm={vi.fn()}
      onHideNewTypeForm={vi.fn()}
    />,
  );
  return {
    onUpdateBlockType,
    input: screen.getByPlaceholderText<HTMLInputElement>('sidebar.addType'),
  };
};

describe('BlockTypesPanel edit form', () => {
  it('shows the displayed name of an unchanged built-in type', () => {
    const { input } = renderEditForm({ id: 'break', name: '☕ Pause', color: '#6B7280' });
    expect(input.value).toBe('☕ Break');
  });

  it('shows a custom name on a built-in id as stored', () => {
    const { input } = renderEditForm({ id: 'break', name: '🍔 Food & Break', color: '#14B8A6' });
    expect(input.value).toBe('🍔 Food & Break');
  });

  it('stores a new name', () => {
    const { input, onUpdateBlockType } = renderEditForm({ id: 'break', name: '☕ Pause', color: '#6B7280' });
    fireEvent.change(input, { target: { value: 'Kaffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'dialog.save' }));
    expect(onUpdateBlockType).toHaveBeenCalledWith('break', 'Kaffee', '#6B7280');
  });

  it('keeps the stored name when only the color changes', () => {
    const { onUpdateBlockType } = renderEditForm({ id: 'break', name: '☕ Pause', color: '#6B7280' });
    fireEvent.click(screen.getByRole('button', { name: '#EF4444' }));
    fireEvent.click(screen.getByRole('button', { name: 'dialog.save' }));
    expect(onUpdateBlockType).toHaveBeenCalledWith('break', '☕ Pause', '#EF4444');
  });
});
