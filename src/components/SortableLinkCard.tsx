import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { LinkCard } from './LinkCard';
import type { LinkItem } from '../types/nav';

interface SortableLinkCardProps {
  link: LinkItem;
  categoryId: string;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
}

/**
 * Grid wrapper that makes an existing LinkCard draggable.
 *
 * The wrapper — not LinkCard — is the grid item, so the card can stay layout
 * agnostic. Only the grip receives the drag listeners: attaching a PointerSensor
 * to the whole card would fight the page's touch scrolling on mobile.
 */
export function SortableLinkCard({ link, categoryId, onEdit, onDelete }: SortableLinkCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: link.id,
      data: { type: 'link', categoryId },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card-drag-wrap"
      data-dragging={isDragging}
    >
      <LinkCard
        link={link}
        manageMode
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            title="拖动排序"
            aria-label={`拖动排序 ${link.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={13} strokeWidth={2.2} />
          </button>
        }
      />
    </div>
  );
}
