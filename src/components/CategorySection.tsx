import { Plus } from 'lucide-react';
import type { CategoryWithLinks } from '../types/nav';
import { LinkCard } from './LinkCard';
import type { LinkItem } from '../types/nav';

interface CategorySectionProps {
  category: CategoryWithLinks;
  manageMode: boolean;
  categoryIndex: number;
  onAddLink: (categoryId: string) => void;
  onEditLink: (link: LinkItem) => void;
  onDeleteLink: (link: LinkItem) => void;
  onRenameCategory: (category: CategoryWithLinks) => void;
  onDeleteCategory: (category: CategoryWithLinks) => void;
}

const DOT_COLORS = ['#6366F1', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9'];

export function CategorySection({
  category,
  manageMode,
  categoryIndex,
  onAddLink,
  onEditLink,
  onDeleteLink,
  onRenameCategory,
  onDeleteCategory,
}: CategorySectionProps) {
  const dotColor = DOT_COLORS[categoryIndex % DOT_COLORS.length];

  return (
    <section
      className="tray"
      style={{ animationDelay: `${Math.min(categoryIndex, 6) * 45}ms` }}
      aria-label={category.name}
    >
      <div className="tray-head">
        <div className="tray-title">
          <span className="cat-dot" style={{ background: dotColor }} />
          <span className="tray-name">{category.name}</span>
        </div>

        <div className="tray-tools">
          {manageMode ? (
            <>
              <button
                type="button"
                className="link-btn"
                onClick={() => onRenameCategory(category)}
              >
                重命名
              </button>
              <button
                type="button"
                className="link-btn danger"
                onClick={() => onDeleteCategory(category)}
              >
                删除分类
              </button>
            </>
          ) : (
            <span className="count-pill">{category.links.length} 项</span>
          )}
        </div>
      </div>

      <div className="grid">
        {category.links.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            manageMode={manageMode}
            onEdit={onEditLink}
            onDelete={onDeleteLink}
          />
        ))}

        {manageMode ? (
          <button
            type="button"
            className="add-slot"
            onClick={() => onAddLink(category.id)}
          >
            <span className="add-slot-plus">
              <Plus size={13} strokeWidth={2.4} />
            </span>
            添加网址
          </button>
        ) : null}
      </div>
    </section>
  );
}
