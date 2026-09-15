import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OptionDTO } from '../types/api';

interface SortableOptionProps {
  id: string;
  index: number;
  text: string;
}

function SortableOption({ id, index, text }: SortableOptionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-surface-container transition-colors ${
        isDragging ? 'opacity-60 border-primary' : 'border-outline-variant'
      }`}
    >
      <span className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold font-mono flex-shrink-0">
        {index + 1}
      </span>
      <span className="flex-1 text-sm text-on-surface">{text}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${text}`}
        className="p-2 -mr-2 text-on-surface-variant hover:text-on-surface cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
      </button>
    </li>
  );
}

interface RankedChoiceVoterProps {
  options: OptionDTO[];
  order: number[];
  onChange: (order: number[]) => void;
}

// Full-permutation ranked-choice voting UI: drag (or use arrow keys while
// focused on the handle) to reorder options from most to least preferred.
export default function RankedChoiceVoter({ options, order, onChange }: RankedChoiceVoterProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => String(i) === active.id);
    const newIndex = order.findIndex((i) => String(i) === over.id);
    onChange(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order.map(String)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {order.map((optionIndex, position) => (
            <SortableOption
              key={optionIndex}
              id={String(optionIndex)}
              index={position}
              text={options[optionIndex]?.text ?? ''}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
