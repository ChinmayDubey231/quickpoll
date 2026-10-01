import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OptionDTO } from "../types/api";

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
      className={`relative flex min-h-[60px] items-center gap-3.5 rounded-xl border bg-qp-bg py-2.5 pl-[18px] pr-2 [transition:border-color_.2s,box-shadow_.2s] ${
        isDragging ? "z-10 border-qp-accent shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]" : "border-qp-line"
      }`}
    >
      <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-qp-line font-brand-mono text-xs font-bold tabular-nums text-qp-muted">
        {index + 1}
      </span>
      <span className="flex-1 text-lg font-medium leading-snug">{text}</span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${text}, ranked ${index + 1}`}
        className="grid h-11 w-11 flex-none cursor-grab touch-none place-items-center rounded-lg text-qp-muted transition-colors hover:bg-qp-track hover:text-qp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-qp-accent active:cursor-grabbing"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
    </li>
  );
}

interface RankedChoiceVoterProps {
  options: OptionDTO[];
  order: number[];
  onChange: (order: number[]) => void;
}

// Full-permutation ranked-choice voting UI: drag (or, with the handle focused,
// Space then the arrow keys) to reorder options from most to least preferred.
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
        <ol className="flex flex-col gap-2.5">
          {order.map((optionIndex, position) => (
            <SortableOption
              key={optionIndex}
              id={String(optionIndex)}
              index={position}
              text={options[optionIndex]?.text ?? ""}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
